import { Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async list(filters: { status?: string; method?: string; from?: string; to?: string }) {
    const where: string[] = [];
    const values: (string | number)[] = [];
    if (filters.status) { where.push('p.status = ?'); values.push(filters.status); }
    if (filters.method) { where.push('p.method = ?'); values.push(filters.method); }
    if (filters.from) { where.push('p.createdAt >= ?'); values.push(`${filters.from} 00:00:00`); }
    if (filters.to) { where.push('p.createdAt < DATE_ADD(?, INTERVAL 1 DAY)'); values.push(filters.to); }
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT p.*, b.code AS bookingCode, u.fullName AS receivedByName
       FROM payments p LEFT JOIN bookings b ON b.id=p.bookingId
       LEFT JOIN users u ON u.id=p.receivedBy
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY p.createdAt DESC LIMIT 500`, values);
    return rows;
  }

  async listRefunds(status?: string) {
    const values: string[] = [];
    const where = status ? 'WHERE r.status=?' : '';
    if (status) values.push(status);
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT r.*,p.method,p.amount AS paymentAmount,p.providerReference,
       b.code AS bookingCode,rq.fullName AS requesterName,ap.fullName AS approverName
       FROM refunds r JOIN payments p ON p.id=r.paymentId
       LEFT JOIN bookings b ON b.id=p.bookingId
       LEFT JOIN users rq ON rq.id=r.requestedBy
       LEFT JOIN users ap ON ap.id=r.approvedBy
       ${where} ORDER BY r.requestedAt DESC LIMIT 500`, values);
    return rows;
  }

  async detail(id: number) {
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT p.*, b.code AS bookingCode, u.fullName AS receivedByName
       FROM payments p LEFT JOIN bookings b ON b.id=p.bookingId
       LEFT JOIN users u ON u.id=p.receivedBy WHERE p.id=?`, [id]);
    if (!rows[0]) return null;
    const [refunds] = await this.db.pool.execute<any[]>(
      `SELECT r.*, rq.fullName AS requesterName, ap.fullName AS approverName
       FROM refunds r LEFT JOIN users rq ON rq.id=r.requestedBy
       LEFT JOIN users ap ON ap.id=r.approvedBy WHERE r.paymentId=? ORDER BY r.requestedAt DESC`, [id]);
    return { ...rows[0], refunds };
  }

  async createCashPayment(input: { bookingId: number; amount: number; userId: number; reference: string }) {
    const connection = await this.db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [bookings] = await connection.execute<any[]>('SELECT * FROM bookings WHERE id=? FOR UPDATE', [input.bookingId]);
      const booking = bookings[0];
      if (!booking) throw new Error('BOOKING_NOT_FOUND');
      if (!['PENDING_DEPOSIT', 'DEPOSIT_PAID', 'CHECKED_IN'].includes(booking.status)) throw new Error('BOOKING_NOT_PAYABLE');
      const [sumRows] = await connection.execute<any[]>(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE bookingId=? AND status='SUCCEEDED'`, [input.bookingId]);
      const targetTotal = booking.status === 'PENDING_DEPOSIT' ? Number(booking.depositDue) : Number(booking.pitchAmount) + Number(booking.serviceAmount || 0);
      const due = Math.max(0, targetTotal - Number(sumRows[0].total));
      if (input.amount <= 0 || input.amount > due) throw new Error('INVALID_AMOUNT');
      const purpose = booking.status === 'PENDING_DEPOSIT' ? 'DEPOSIT' : 'SETTLEMENT';
      const [result] = await connection.execute<any>(
        `INSERT INTO payments (bookingId,purpose,method,provider,providerReference,amount,status,paidAt,receivedBy)
         VALUES (?,?,'CASH','CASHIER',?,?,'SUCCEEDED',UTC_TIMESTAMP(),?)`,
        [input.bookingId, purpose, input.reference, input.amount, input.userId]);
      if (booking.status === 'PENDING_DEPOSIT' && input.amount + Number(sumRows[0].total) >= Number(booking.depositDue)) {
        await connection.execute("UPDATE bookings SET status='DEPOSIT_PAID',expiresAt=NULL WHERE id=?", [input.bookingId]);
        await connection.execute("UPDATE slot_occupancy SET state='CONFIRMED',expiresAt=NULL WHERE bookingId=?", [input.bookingId]);
        await connection.execute("UPDATE service_orders SET status='CONFIRMED' WHERE bookingId=? AND status='DRAFT'", [input.bookingId]);
      }
      await connection.execute(
        `INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'PAYMENT_CASH_RECORDED','PAYMENT',?,JSON_OBJECT('bookingId',?,'amount',?,'method','CASH'))`,
        [input.userId, String(result.insertId), input.bookingId, input.amount]);
      await connection.commit();
      return result.insertId;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async requestRefund(paymentId: number, amount: number, reason: string, userId: number) {
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [payments] = await c.execute<any[]>('SELECT * FROM payments WHERE id=? FOR UPDATE', [paymentId]);
      const payment = payments[0];
      if (!payment) throw new Error('PAYMENT_NOT_FOUND');
      if (payment.status !== 'SUCCEEDED') throw new Error('PAYMENT_NOT_REFUNDABLE');
      const [totals] = await c.execute<any[]>(
        `SELECT COALESCE(SUM(amount),0) AS total FROM refunds WHERE paymentId=? AND status IN ('REQUESTED','APPROVED','PAID')`, [paymentId]);
      if (!Number.isInteger(amount) || amount <= 0 || Number(totals[0].total) + amount > Number(payment.amount)) throw new Error('REFUND_LIMIT');
      const [result] = await c.execute<any>(
        `INSERT INTO refunds(paymentId,amount,reason,status,requestedBy) VALUES (?,?,?,'REQUESTED',?)`,
        [paymentId, amount, reason, userId]);
      await c.execute(
        `INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'REFUND_REQUESTED','REFUND',?,JSON_OBJECT('paymentId',?,'amount',?,'reason',?))`,
        [userId, String(result.insertId), paymentId, amount, reason]);
      await c.commit();
      return result.insertId;
    } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
  }

  async transitionRefund(refundId: number, action: 'APPROVED'|'REJECTED'|'PAID'|'FAILED', userId: number, reference?: string, reason?: string) {
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.execute<any[]>(
        `SELECT r.*,p.status AS paymentStatus FROM refunds r JOIN payments p ON p.id=r.paymentId WHERE r.id=? FOR UPDATE`, [refundId]);
      const refund = rows[0];
      if (!refund) throw new Error('REFUND_NOT_FOUND');
      const allowed: Record<string,string[]> = { APPROVED:['REQUESTED'], REJECTED:['REQUESTED'], PAID:['APPROVED'], FAILED:['APPROVED'] };
      if (!allowed[action].includes(refund.status)) throw new Error('INVALID_REFUND_TRANSITION');
      if (action === 'PAID' && refund.paymentStatus !== 'SUCCEEDED') throw new Error('PAYMENT_NOT_REFUNDABLE');
      await c.execute(
        `UPDATE refunds SET status=?, approvedBy=IF(? IN ('APPROVED','REJECTED'),?,approvedBy),
         paidAt=IF(?='PAID',UTC_TIMESTAMP(),paidAt), providerReference=COALESCE(?,providerReference), rejectReason=IF(?='REJECTED',?,rejectReason) WHERE id=?`,
        [action, action, userId, action, reference || null, action, reason || null, refundId]);
      await c.execute(
        `INSERT INTO audit_logs(actorId,action,entityType,entityId,beforeData,afterData)
         VALUES (?,?,?,?,JSON_OBJECT('status',?),JSON_OBJECT('status',?,'paymentId',?,'amount',?))`,
        [userId, `REFUND_${action}`, 'REFUND', String(refundId), refund.status, action, refund.paymentId, refund.amount]);
      let cancelledBookingId: number | null = null;
      if (action === 'PAID' && /hủy sân|bảo trì sân/i.test(String(refund.reason))) {
        const [bookingRows] = await c.execute<any[]>(
          'SELECT bookingId FROM payments WHERE id=? FOR UPDATE', [refund.paymentId]);
        const bookingId = bookingRows[0]?.bookingId;
        if (bookingId) {
          cancelledBookingId = Number(bookingId);
          await c.execute(`UPDATE inventory i JOIN (SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) qty FROM service_orders so JOIN service_order_items si ON si.orderId=so.id WHERE so.bookingId=? AND so.isDelivered=0 AND so.isRestocked=0 GROUP BY so.complexId,si.serviceId) x ON x.complexId=i.complexId AND x.serviceId=i.serviceId SET i.reserved=GREATEST(0,i.reserved-x.qty)`, [bookingId]);
          await c.execute("UPDATE service_orders SET status='CANCELLED',isRestocked=1 WHERE bookingId=? AND isDelivered=0 AND isRestocked=0", [bookingId]);
          await c.execute("UPDATE bookings SET status='CANCELLED' WHERE id=? AND status='DEPOSIT_PAID'", [bookingId]);
          await c.execute('DELETE FROM slot_occupancy WHERE bookingId=?', [bookingId]);
        }
      }
      await c.commit();
      return { id: refundId, status: action, bookingId: cancelledBookingId };
    } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
  }

  async findBookingSlot(bookingId: number) {
    const [rows] = await this.db.pool.execute<any[]>(`SELECT pitchId,slotId,date,status FROM bookings WHERE id=?`, [bookingId]);
    return rows[0] || null;
  }

  async findPaymentBookingOwner(paymentId: number): Promise<number | null> {
    const [rows] = await this.db.pool.execute<any[]>(
      'SELECT b.customerId FROM payments p JOIN bookings b ON b.id=p.bookingId WHERE p.id=? LIMIT 1',
      [paymentId],
    );
    return rows[0]?.customerId == null ? null : Number(rows[0].customerId);
  }
  async getBookingsByCustomer(customerId: number) {
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT b.*,p.name AS pitchName,s.start,s.end FROM bookings b
       JOIN pitches p ON p.id=b.pitchId JOIN slots s ON s.id=b.slotId
       WHERE b.customerId=? ORDER BY b.createdAt DESC`, [customerId]);
    return rows;
  }

}
