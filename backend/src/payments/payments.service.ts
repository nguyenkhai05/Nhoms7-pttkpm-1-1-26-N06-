import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository.js';

@Injectable()
export class PaymentsService {
  constructor(private readonly repo: PaymentsRepository) {}
  private translate(error: unknown): never {
    const code = error instanceof Error ? error.message : '';
    const messages: Record<string,string> = {
      PAYMENT_NOT_FOUND:'Không tìm thấy giao dịch.', PAYMENT_NOT_REFUNDABLE:'Chỉ giao dịch SUCCEEDED mới được hoàn tiền.',
      REFUND_LIMIT:'Tổng tiền hoàn vượt số tiền giao dịch gốc hoặc số tiền không hợp lệ.',
      INVALID_REFUND_TRANSITION:'Trạng thái hoàn tiền không cho phép chuyển bước này.',
      REFUND_NOT_FOUND:'Không tìm thấy yêu cầu hoàn tiền.', BOOKING_NOT_FOUND:'Không tìm thấy booking.',
      BOOKING_NOT_PAYABLE:'Booking không ở trạng thái có thể thu tiền.', INVALID_AMOUNT:'Số tiền thu không hợp lệ hoặc vượt số tiền còn phải thu.',
    };
    if (messages[code]) {
      if (code.endsWith('NOT_FOUND')) throw new NotFoundException(messages[code]);
      throw new BadRequestException(messages[code]);
    }
    throw error;
  }
  async list(filters: {status?:string;method?:string;from?:string;to?:string}) {
    if (filters.status && !['PENDING','SUCCEEDED','FAILED'].includes(filters.status)) throw new BadRequestException('Trạng thái giao dịch không hợp lệ.');
    if (filters.method && !['CASH','BANK_QR'].includes(filters.method)) throw new BadRequestException('Hình thức thanh toán không hợp lệ.');
    return this.repo.list(filters);
  }
  async listRefunds(status?:string) {
    if (status && !['REQUESTED','APPROVED','PAID','REJECTED','FAILED'].includes(status)) {
      throw new BadRequestException('Trạng thái hoàn tiền không hợp lệ.');
    }
    return this.repo.listRefunds(status);
  }
  async detail(id:number) {
    const payment=await this.repo.detail(id);
    if(!payment) throw new NotFoundException('Không tìm thấy giao dịch.');
    return payment;
  }
  async recordCash(input:{bookingId:number;amount:number;userId:number}) {
    try {
      const reference=`CASH_${input.bookingId}_${Date.now()}`;
      const id=await this.repo.createCashPayment({...input,reference});
      return this.detail(Number(id));
    } catch(e) { return this.translate(e); }
  }
  async requestRefund(id:number,input:{amount:number;reason:string;userId:number}) {
    if(!input.reason?.trim()) throw new BadRequestException('Vui lòng nhập lý do hoàn tiền.');
    try {
      const refundId=await this.repo.requestRefund(id,input.amount,input.reason.trim(),input.userId);
      return {id:refundId,status:'REQUESTED'};
    } catch(e) { return this.translate(e); }
  }
  async transitionRefund(id:number,action:'APPROVED'|'REJECTED'|'PAID'|'FAILED',userId:number,reference?:string) {
    try { return await this.repo.transitionRefund(id,action,userId,reference); }
    catch(e) { return this.translate(e); }
  }

  async payDeposit(bookingId:number,method:'CASH'|'BANK_QR') {
    const booking=await this.repo.findBookingById(bookingId);
    if(!booking) throw new NotFoundException('Không tìm thấy đơn đặt sân');
    if(booking.status!=='PENDING_DEPOSIT') throw new BadRequestException('Đơn đặt sân không ở trạng thái chờ đặt cọc');
    const ref=`DEP_${booking.code}_${Date.now()}`;
    await this.repo.createDepositPayment(bookingId,booking.depositDue,method,ref);
    await this.repo.updateBookingStatus(bookingId,'DEPOSIT_PAID');
    await this.repo.confirmSlotOccupancy(bookingId);
    return {success:true,bookingId,status:'DEPOSIT_PAID',reference:ref};
  }
  async getMyBookings(userId:number) { return this.repo.getBookingsByCustomer(userId); }
  async cancelBooking(bookingId:number,reason:string,userId:number|null) {
    const booking=await this.repo.findBookingById(bookingId);
    if(!booking) throw new NotFoundException('Không tìm thấy đơn đặt sân');
    if(['CANCELLED','COMPLETED'].includes(booking.status)) throw new BadRequestException('Không thể hủy đơn này');
    const wasDepositPaid=booking.status==='DEPOSIT_PAID';
    await this.repo.updateBookingStatus(bookingId,'CANCELLED');
    await this.repo.releaseSlotOccupancy(bookingId);
    if(wasDepositPaid) {
      const payment=await this.repo.findSucceededPaymentByBooking(bookingId);
      if(payment) await this.repo.createRefundRequest(payment.id,payment.amount,reason||'Khách hủy sân',userId);
    }
    return {success:true,status:'CANCELLED'};
  }
}
