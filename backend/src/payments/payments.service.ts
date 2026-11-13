import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentsRepository } from './payments.repository.js';
import type { DepositInfo } from './payments.types.js';

@Injectable()
export class PaymentsService {
  constructor(@Inject(PaymentsRepository) private readonly repository: PaymentsRepository) {}

  async getDepositInfo(bookingId: number, customerId: number): Promise<DepositInfo> {
    const booking = await this.repository.findBookingForCustomer(bookingId, customerId);
    // Đơn của người khác cũng trả 404, để không lộ đơn có tồn tại hay không.
    if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt sân');
    if (booking.status !== 'PENDING_DEPOSIT' || !booking.expiresAt) {
      throw new ConflictException('Đơn không còn ở trạng thái chờ đặt cọc');
    }
    // expiresAt là giờ UTC dạng "YYYY-MM-DD HH:mm:ss" (dateStrings=true).
    const expiresMs = new Date(booking.expiresAt.replace(' ', 'T') + 'Z').getTime();
    if (expiresMs <= Date.now()) throw new ConflictException('Đã hết thời gian giữ chỗ');

    const bank = await this.repository.findActiveBankAccount(booking.complexId);
    if (!bank) throw new ServiceUnavailableException('Cụm sân chưa cấu hình tài khoản nhận tiền');

    return {
      bookingId: booking.bookingId,
      code: booking.code,
      amount: booking.depositDue,
      expiresAt: booking.expiresAt,
      transferContent: booking.code,
      bank,
    };
  }
}