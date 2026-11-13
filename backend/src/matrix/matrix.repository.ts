import { Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

@Injectable()
export class MatrixRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async getActivePitches() {
    const [rows] = await this.db.pool.execute<any[]>('SELECT id, name, type, price FROM pitches WHERE status = "ACTIVE"');
    return rows;
  }

  async getAllSlots() {
    const [rows] = await this.db.pool.execute<any[]>('SELECT id, start, end FROM slots ORDER BY start ASC');
    return rows;
  }

  async getBookingsByDate(date: string) {
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT id, pitchId, slotId, status, guestName, guestPhone, totalAmount, depositDue
       FROM bookings 
       WHERE date = ? AND status != 'CANCELLED'`,
      [date],
    );
    return rows;
  }

  async createWalkInBooking(
    code: string,
    pitchId: number,
    slotId: number,
    date: string,
    guestName: string,
    guestPhone: string,
    totalAmount: number
  ) {
    const [res] = await this.db.pool.execute<any>(
      `INSERT INTO bookings (code, customerId, pitchId, slotId, date, status, guestName, guestPhone, pitchAmount, serviceAmount, totalAmount, depositDue)
       VALUES (?, NULL, ?, ?, ?, 'COMPLETED', ?, ?, ?, 0, ?, 0)`,
      [code, pitchId, slotId, date, guestName, guestPhone, totalAmount, totalAmount],
    );
    return res.insertId;
  }

  async checkInBooking(bookingId: number) {
    await this.db.pool.execute(
      `UPDATE bookings SET status = 'COMPLETED' WHERE id = ?`,
      [bookingId],
    );
  }
}