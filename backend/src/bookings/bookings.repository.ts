import { Injectable } from '@nestjs/common';
import type { RowDataPacket } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

export interface RequestedService {
  serviceId: number;
  quantity: number;
}

export interface AvailableService {
  id: number;
  name: string;
  kind: 'SALE' | 'RENTAL';
  unit: string;
  price: number;
  availableQuantity: number;
}

export interface BookingRecord {
  id: number;
  code: string;
  pitchId: number;
  pitchName: string;
  slotId: number;
  slotStart: string;
  slotEnd: string;
  date: string;
  status: string;
  pitchAmount: number;
  serviceAmount: number;
  totalAmount: number;
  depositDue: number;
  expiresAt: string | null;
  createdAt: string;
}

@Injectable()
export class BookingsRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async listServices(pitchId: number): Promise<AvailableService[]> {
    return this.db.rows<AvailableService>(
      `SELECT s.id,s.name,s.kind,s.unit,s.price,
              (i.quantity-i.reserved) AS availableQuantity
       FROM pitches p
       JOIN inventory i ON i.complexId=p.complexId
       JOIN services s ON s.id=i.serviceId
       WHERE p.id=? AND p.status='ACTIVE' AND s.active=TRUE
       ORDER BY s.name,s.id`,
      [pitchId],
    );
  }

  async holdSlot(
    pitchId: number,
    slotId: number,
    date: string,
    customerId: number,
    code: string,
    services: RequestedService[],
  ): Promise<number> {
    const [result] = await this.db.pool.query(
      'CALL sp_hold_slot(?,?,?,?,?,?)',
      [pitchId, slotId, date, customerId, code, JSON.stringify(services)],
    );
    const resultSets = result as unknown as Array<Array<{ bookingId: number }>>;
    const bookingId = Number(resultSets?.[0]?.[0]?.bookingId);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      throw new Error('Stored procedure không trả về bookingId hợp lệ.');
    }
    return bookingId;
  }

  async findForCustomer(bookingId: number, customerId: number): Promise<BookingRecord | null> {
    const rows = await this.db.rows<RowDataPacket & BookingRecord>(
      `SELECT b.id,b.code,b.pitchId,p.name AS pitchName,b.slotId,
              sl.start AS slotStart,sl.end AS slotEnd,b.date,b.status,
              b.pitchAmount,
              COALESCE((SELECT SUM(si.quantity*si.unitPrice)
                        FROM service_orders so
                        JOIN service_order_items si ON si.orderId=so.id
                        WHERE so.bookingId=b.id),0) AS serviceAmount,
              b.pitchAmount + COALESCE((SELECT SUM(si.quantity*si.unitPrice)
                        FROM service_orders so
                        JOIN service_order_items si ON si.orderId=so.id
                        WHERE so.bookingId=b.id),0) AS totalAmount,
              b.depositDue,b.expiresAt,b.createdAt
       FROM bookings b
       JOIN pitches p ON p.id=b.pitchId
       JOIN slots sl ON sl.id=b.slotId AND sl.pitchId=b.pitchId
       WHERE b.id=? AND b.customerId=? LIMIT 1`,
      [bookingId, customerId],
    );
    return rows[0] ?? null;
  }

  async cancelHold(bookingId: number, customerId: number): Promise<void> {
    await this.db.pool.query('CALL sp_cancel_pending_hold(?,?)', [bookingId, customerId]);
  }

  async expiredHolds(): Promise<Array<{ bookingId: number; pitchId: number; slotId: number; date: string }>> {
    return this.db.rows(
      `SELECT b.id AS bookingId,b.pitchId,b.slotId,b.date
       FROM bookings b
       WHERE b.status='PENDING_DEPOSIT' AND b.expiresAt<=UTC_TIMESTAMP()
       ORDER BY b.expiresAt LIMIT 100`,
    );
  }

  async expirePendingBookings(): Promise<void> {
    await this.db.pool.query('CALL sp_expire_pending_bookings()');
  }
}
