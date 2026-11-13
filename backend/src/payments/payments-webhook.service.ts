import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { parseWebhookEvent, type WebhookEvent } from './dto/payment-webhook.dto.js';
import { PaymentsRepository } from './payments.repository.js';
import { verifyWebhookSignature } from './webhook-signature.js';

export interface WebhookResult {
  status: string;
  bookingId?: number;
  reason?: string;
  duplicate?: boolean;
}

/** procedure dùng SIGNAL SQLSTATE 45000 cho các vi phạm quy tắc (sai tiền, trễ hạn...). */
function isRuleViolation(error: unknown): error is { sqlMessage: string } {
  return typeof error === 'object' && error !== null && 'sqlState' in error && error.sqlState === '45000';
}

@Injectable()
export class PaymentsWebhookService {
  constructor(@Inject(PaymentsRepository) private readonly repository: PaymentsRepository) {}

  async handle(body: unknown, signature: string | undefined): Promise<WebhookResult> {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    // Thiếu bí mật thì từ chối hẳn, không bao giờ nhận webhook không ký.
    if (!secret || secret.length < 32) throw new ServiceUnavailableException('Webhook thanh toán chưa được cấu hình');

    const event = parseWebhookEvent(body);
    if (!verifyWebhookSignature(secret, event, signature)) {
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ');
    }

    const isNew = await this.repository.insertEvent(event);
    if (!isNew) {
      const status = (await this.repository.findEventStatus(event.provider, event.eventId)) ?? 'RECEIVED';
      // Đã xử lý xong thì trả kết quả cũ; còn RECEIVED nghĩa là lần trước dừng giữa chừng, xử lý tiếp.
      if (status !== 'RECEIVED') return { status, duplicate: true };
    }
    return this.process(event);
  }

  private async process(event: WebhookEvent): Promise<WebhookResult> {
    const bookingId = await this.repository.findBookingIdByCode(event.bookingCode);
    if (bookingId === null) {
      await this.repository.markEvent(event, 'NEEDS_REVIEW', null);
      return { status: 'NEEDS_REVIEW', reason: 'Không tìm thấy đơn đặt sân' };
    }
    try {
      await this.repository.confirmDeposit(bookingId, event);
    } catch (error) {
      if (isRuleViolation(error)) {
        await this.repository.markEvent(event, 'NEEDS_REVIEW', null);
        return { status: 'NEEDS_REVIEW', bookingId, reason: error.sqlMessage };
      }
      throw error;
    }
    const paymentId = await this.repository.findPaymentId(event.provider, event.providerReference);
    await this.repository.markEvent(event, 'PROCESSED', paymentId);
    return { status: 'PROCESSED', bookingId };
  }
}