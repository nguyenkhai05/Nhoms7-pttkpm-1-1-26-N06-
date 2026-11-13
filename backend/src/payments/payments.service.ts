import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly repo: PaymentsRepository) {}

  async payDeposit(bookingId: number, method: 'CASH' | 'BANK_QR') {
    const booking = await this.repo.findBookingById(bookingId);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt sân');
    if (booking.status !== 'PENDING_DEPOSIT') {
      throw new BadRequestException('Đơn đặt sân không ở trạng thái chờ đặt cọc');
    }

    const ref = `DEP_${booking.code}_${Date.now()}`;
    await this.repo.createDepositPayment(bookingId, booking.depositDue, method, ref);
    await this.repo.updateBookingStatus(bookingId, 'DEPOSIT_PAID');
    await this.repo.confirmSlotOccupancy(bookingId);

    return { success: true, bookingId, status: 'DEPOSIT_PAID', reference: ref };
  }

  async getMyBookings(userId: number) {
    return this.repo.getBookingsByCustomer(userId);
  }

  async cancelBooking(bookingId: number, reason: string, userId: number | null) {
    const booking = await this.repo.findBookingById(bookingId);
    if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt sân');

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      throw new BadRequestException('Không thể hủy đơn này');
    }

    const wasDepositPaid = booking.status === 'DEPOSIT_PAID';
    await this.repo.updateBookingStatus(bookingId, 'CANCELLED');
    await this.repo.releaseSlotOccupancy(bookingId);

    if (wasDepositPaid) {
      const payment = await this.repo.findSucceededPaymentByBooking(bookingId);
      if (payment) {
        await this.repo.createRefundRequest(payment.id, payment.amount, reason || 'Khách hủy sân', userId);
      }
    }

    return { success: true, status: 'CANCELLED' };
  }
}