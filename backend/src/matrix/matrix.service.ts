import { Injectable } from '@nestjs/common';
import { MatrixRepository } from './matrix.repository.js';

@Injectable()
export class MatrixService {
  constructor(private readonly repo: MatrixRepository) {}

  async getMatrixData(date: string) {
    // Lấy song song danh sách sân, ca và đơn đặt trong ngày
    const [pitches, slots, bookings] = await Promise.all([
      this.repo.getActivePitches(),
      this.repo.getAllSlots(),
      this.repo.getBookingsByDate(date),
    ]);

    return { pitches, slots, bookings };
  }

  async createWalkInBooking(data: { 
    pitchId: number; 
    slotId: number; 
    date: string; 
    guestName: string; 
    guestPhone: string; 
    totalAmount: number 
  }) {
    // Tạo mã đơn tự động cho khách vãng lai (đặt tại quầy)
    const code = `WALK_${Date.now().toString().slice(-6)}`;
    
    const id = await this.repo.createWalkInBooking(
      code,
      data.pitchId,
      data.slotId,
      data.date,
      data.guestName || 'Khách vãng lai',
      data.guestPhone || '',
      data.totalAmount || 0,
    );

    return { success: true, bookingId: id, code };
  }

  async checkInBooking(bookingId: number) {
    await this.repo.checkInBooking(bookingId);
    return { success: true, status: 'COMPLETED' };
  }
}