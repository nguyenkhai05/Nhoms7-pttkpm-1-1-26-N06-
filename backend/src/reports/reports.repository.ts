import { Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

export interface CashEvent {
  localDate: string;
  kind: 'PAYMENT' | 'REFUND';
  amount: number;
  pitchAmount: number;
  serviceAmount: number;
  serviceOnly: number;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async cashEvents(from: string, to: string): Promise<CashEvent[]> {
    const bounds = [from, to];
    const bookingService = `COALESCE((SELECT SUM(si.quantity * si.unitPrice)
      FROM service_orders so JOIN service_order_items si ON si.orderId=so.id
      WHERE so.bookingId=p.bookingId AND so.status <> 'CANCELLED'),0)`;
    const select = (kind: 'PAYMENT' | 'REFUND') => `
      SELECT DATE_FORMAT(DATE_ADD(${kind === 'PAYMENT' ? 'p.paidAt' : 'r.paidAt'}, INTERVAL 7 HOUR),'%Y-%m-%d') AS localDate,
        '${kind}' AS kind, ${kind === 'PAYMENT' ? 'p.amount' : 'r.amount'} AS amount,
        COALESCE(b.pitchAmount,0) AS pitchAmount, ${bookingService} AS serviceAmount,
        IF(p.serviceOrderId IS NULL,0,1) AS serviceOnly
      FROM ${kind === 'PAYMENT' ? 'payments p' : 'refunds r JOIN payments p ON p.id=r.paymentId'}
      LEFT JOIN bookings b ON b.id=p.bookingId
      WHERE ${kind === 'PAYMENT' ? "p.status='SUCCEEDED'" : "r.status='PAID'"}
        AND ${kind === 'PAYMENT' ? 'p.paidAt' : 'r.paidAt'} >= DATE_SUB(CONCAT(?,' 00:00:00'), INTERVAL 7 HOUR)
        AND ${kind === 'PAYMENT' ? 'p.paidAt' : 'r.paidAt'} < DATE_SUB(DATE_ADD(CONCAT(?,' 00:00:00'), INTERVAL 1 DAY), INTERVAL 7 HOUR)`;
    return this.db.rows<CashEvent>(`${select('PAYMENT')} UNION ALL ${select('REFUND')}`, [...bounds, ...bounds]);
  }

  async bookingCounts(from: string, to: string): Promise<{ confirmed: number; pending: number }> {
    const [row] = await this.db.rows<{ confirmed: number; pending: number }>(
      `SELECT COALESCE(SUM(status IN ('DEPOSIT_PAID','CHECKED_IN','COMPLETED')),0) AS confirmed,
              COALESCE(SUM(status='PENDING_DEPOSIT'),0) AS pending
       FROM bookings WHERE date BETWEEN ? AND ?`, [from, to]);
    return row;
  }

  async occupancy(from: string, to: string): Promise<{ filled: number; capacity: number }> {
    const [row] = await this.db.rows<{ filled: number; capacity: number }>(
      `WITH RECURSIVE days AS (
         SELECT CAST(? AS DATE) AS d
         UNION ALL SELECT d + INTERVAL 1 DAY FROM days WHERE d < CAST(? AS DATE)
       )
       SELECT COUNT(*) AS capacity,
         COALESCE(SUM(o.state='CONFIRMED'),0) AS filled
       FROM days JOIN slots s JOIN pitches p ON p.id=s.pitchId AND p.status='ACTIVE'
       LEFT JOIN slot_occupancy o ON o.pitchId=s.pitchId AND o.slotId=s.id AND o.date=days.d
       WHERE NOT EXISTS (SELECT 1 FROM pitch_blocks pb WHERE pb.pitchId=s.pitchId
         AND pb.startsAt < CONCAT(days.d,' ',s.end,':00')
         AND pb.endsAt > CONCAT(days.d,' ',s.start,':00'))`, [from, to]);
    return row;
  }
}
