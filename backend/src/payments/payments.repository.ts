import { Inject, Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { BankAccountRow, DepositBookingRow } from './payments.types.js';
import type { WebhookEvent } from './dto/payment-webhook.dto.js';
/** Chỉ chứa câu SQL của thanh toán; không có quy tắc nghiệp vụ. */
@Injectable()
export class PaymentsRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  async findBookingForCustomer(bookingId: number, customerId: number): Promise<DepositBookingRow | null> {
    const [row] = await this.db.rows<DepositBookingRow>(
      'SELECT b.id AS bookingId,b.code,b.status,b.depositDue,b.expiresAt,p.complexId ' +
        'FROM bookings b JOIN pitches p ON p.id=b.pitchId WHERE b.id=? AND b.customerId=?',
      [bookingId, customerId],
    );
    return row ?? null;
  }

  // Cố ý không chọn secretEnvKey để không bao giờ lộ ra API.
  async findActiveBankAccount(complexId: number): Promise<BankAccountRow | null> {
    const [row] = await this.db.rows<BankAccountRow>(
      'SELECT bankCode,accountNumber,accountName,provider FROM bank_accounts ' +
        'WHERE complexId=? AND active=TRUE ORDER BY id LIMIT 1',
      [complexId],
    );
    return row ?? null;
  }
    /** Trả true nếu là sự kiện mới, false nếu (provider, eventId) đã có. */
  async insertEvent(event: WebhookEvent): Promise<boolean> {
    try {
      await this.db.pool.execute(
        "INSERT INTO payment_events(provider,eventId,signatureValid,payload,status) VALUES(?,?,TRUE,?,'RECEIVED')",
        [event.provider, event.eventId, JSON.stringify(event)],
      );
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'errno' in error && error.errno === 1062) return false;
      throw error;
    }
  }

  async findEventStatus(provider: string, eventId: string): Promise<string | null> {
    const [row] = await this.db.rows<{ status: string }>(
      'SELECT status FROM payment_events WHERE provider=? AND eventId=?',
      [provider, eventId],
    );
    return row?.status ?? null;
  }

  async markEvent(event: WebhookEvent, status: string, paymentId: number | null): Promise<void> {
    await this.db.pool.execute(
      'UPDATE payment_events SET status=?,paymentId=? WHERE provider=? AND eventId=?',
      [status, paymentId, event.provider, event.eventId],
    );
  }

  async findBookingIdByCode(code: string): Promise<number | null> {
    const [row] = await this.db.rows<{ id: number }>('SELECT id FROM bookings WHERE code=?', [code]);
    return row?.id ?? null;
  }

  /** Procedure tự khóa sân, kiểm số tiền, hạn giữ chỗ và chạy lặp an toàn. */
  async confirmDeposit(bookingId: number, event: WebhookEvent): Promise<void> {
    await this.db.pool.query('CALL sp_confirm_deposit(?,?,?,?)', [
      bookingId,
      event.provider,
      event.providerReference,
      event.amount,
    ]);
  }

  async findPaymentId(provider: string, providerReference: string): Promise<number | null> {
    const [row] = await this.db.rows<{ id: number }>(
      'SELECT id FROM payments WHERE provider=? AND providerReference=?',
      [provider, providerReference],
    );
    return row?.id ?? null;
  }
}