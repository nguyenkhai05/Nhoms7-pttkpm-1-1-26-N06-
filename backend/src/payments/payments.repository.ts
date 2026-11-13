import { Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async findBookingById(id: number) {
    const [rows] = await this.db.pool.execute<any[]>('SELECT * FROM bookings WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async getBookingsByCustomer(customerId: number) {
    const sql = `
      SELECT b.*, p.name AS pitchName, s.start, s.end
      FROM bookings b
      JOIN pitches p ON p.id = b.pitchId
      JOIN slots s ON s.id = b.slotId
      WHERE b.customerId = ?
      ORDER BY b.createdAt DESC
    `;
    const [rows] = await this.db.pool.execute<any[]>(sql, [customerId]);
    return rows;
  }

  async createDepositPayment(bookingId: number, amount: number, method: 'CASH' | 'BANK_QR', ref: string) {
    const [res] = await this.db.pool.execute<any>(
      `INSERT INTO payments (bookingId, purpose, method, provider, providerReference, amount, status, paidAt)
       VALUES (?, 'DEPOSIT', ?, 'VIETQR', ?, ?, 'SUCCEEDED', NOW())`,
      [bookingId, method, ref, amount],
    );
    return res.insertId;
  }

  async updateBookingStatus(bookingId: number, status: string) {
    await this.db.pool.execute('UPDATE bookings SET status = ? WHERE id = ?', [status, bookingId]);
  }

  async confirmSlotOccupancy(bookingId: number) {
    await this.db.pool.execute(
      `UPDATE slot_occupancy SET state = 'CONFIRMED', expiresAt = NULL WHERE bookingId = ?`,
      [bookingId],
    );
  }

  async releaseSlotOccupancy(bookingId: number) {
    await this.db.pool.execute('DELETE FROM slot_occupancy WHERE bookingId = ?', [bookingId]);
  }

  async findSucceededPaymentByBooking(bookingId: number) {
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT * FROM payments WHERE bookingId = ? AND status = 'SUCCEEDED' LIMIT 1`,
      [bookingId],
    );
    return rows[0] || null;
  }

  async createRefundRequest(paymentId: number, amount: number, reason: string, userId: number | null) {
    const [res] = await this.db.pool.execute<any>(
      `INSERT INTO refunds (paymentId, amount, reason, status, requestedBy)
       VALUES (?, ?, ?, 'REQUESTED', ?)`,
      [paymentId, amount, reason, userId],
    );
    return res.insertId;
  }
}