import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import { RedisLockService } from '../bookings/redis-lock.service.js';

export function calculateRefundPolicy(hoursBeforeStart: number, depositAmount: number) {
  const percent = hoursBeforeStart >= 24 ? 100 : hoursBeforeStart >= 12 ? 50 : 0;
  return { refundPercent: percent, refundAmount: Math.floor(Math.max(0, depositAmount) * percent / 100), flow: percent > 0 ? 'NEED_APPROVAL' : 'NO_REFUND' } as const;
}

@Injectable()
export class OperationsService {
  constructor(private readonly db: MysqlDatabase, private readonly redis: RedisLockService) {}
  private async writeAudit(actorId: number | null, action: string, entity: string, id: string | number | null, before?: unknown, after?: unknown) {
    await this.db.pool.execute(
      'INSERT INTO audit_logs(actorId,action,entityType,entityId,beforeData,afterData) VALUES (?,?,?,?,?,?)',
      [actorId, action, entity, id == null ? null : String(id), before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)],
    );
  }
  private int(value: unknown, label: string, min = 1): number {
    const n = Number(value);
    if (!Number.isSafeInteger(n) || n < min) throw new BadRequestException(`${label} không hợp lệ.`);
    return n;
  }
  private validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
  private code(prefix = 'DSN') { return prefix + randomBytes(5).toString('hex').toUpperCase(); }
  private async releaseBookingLock(bookingId:number){const [rows]=await this.db.pool.execute<any[]>('SELECT pitchId,slotId,date FROM bookings WHERE id=?',[bookingId]);const b=rows[0];if(b)await this.redis.release(`booking:slot:${b.pitchId}:${b.slotId}:${String(b.date).slice(0,10)}`,`booking:${bookingId}`); }

  async cancelPreview(id: number, userId: number) {
    const [rows] = await this.db.pool.execute<any[]>(`SELECT b.id,b.code,b.status,b.customerId,b.depositDue,b.date,s.start FROM bookings b JOIN slots s ON s.id=b.slotId WHERE b.id=?`, [this.int(id,'Booking')]);
    const b=rows[0]; if(!b || Number(b.customerId)!==userId) throw new NotFoundException('Không tìm thấy booking của bạn.');
    const startUtc = new Date(`${b.date}T${b.start}:00+07:00`); const hours=(startUtc.getTime()-Date.now())/3600000;
    const [paid]=await this.db.pool.execute<any[]>(`SELECT COALESCE(SUM(amount),0) amount FROM payments WHERE bookingId=? AND status='SUCCEEDED'`,[id]);
    const deposit=Math.min(Number(b.depositDue),Number(paid[0].amount)); const policy=calculateRefundPolicy(hours,deposit);
    return {data:{bookingId:id,bookingCode:b.code,status:b.status,slotStartsAt:startUtc.toISOString(),hoursBefore:Math.round(hours*100)/100,...policy}};
  }
  async cancel(id:number, body:any, userId:number) {
    const preview=(await this.cancelPreview(id,userId)).data;
    if(!['DEPOSIT_PAID','PENDING_DEPOSIT'].includes(preview.status)) throw new ConflictException('Đơn này không thể hủy ở trạng thái hiện tại.');
    if(preview.status==='PENDING_DEPOSIT') { const c=await this.db.pool.getConnection();try{await c.beginTransaction();await c.execute(`UPDATE inventory i JOIN (SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) qty FROM service_orders so JOIN service_order_items si ON si.orderId=so.id WHERE so.bookingId=? AND so.status='DRAFT' GROUP BY so.complexId,si.serviceId) x ON x.complexId=i.complexId AND x.serviceId=i.serviceId SET i.reserved=GREATEST(0,i.reserved-x.qty)`,[id]);await c.execute("UPDATE service_orders SET status='CANCELLED',isRestocked=1 WHERE bookingId=? AND isDelivered=0 AND isRestocked=0",[id]);await c.execute("UPDATE bookings SET status='CANCELLED' WHERE id=?",[id]);await c.execute('DELETE FROM slot_occupancy WHERE bookingId=?',[id]);await c.commit();}catch(e){await c.rollback();throw e;}finally{c.release();} await this.releaseBookingLock(id); await this.writeAudit(userId,'BOOKING_HOLD_CANCELLED','BOOKING',id); return {data:{status:'CANCELLED',refundAmount:0}}; }
    const bankName=String(body.bankName||'').trim(), accountNumber=String(body.accountNumber||'').trim(), accountName=String(body.accountName||'').trim();
    if(preview.refundAmount>0&&(!bankName||!accountNumber||!accountName)) throw new BadRequestException('Cần nhập ngân hàng, số tài khoản và tên chủ tài khoản để hoàn cọc.');
    if(preview.flow==='NO_REFUND'&&!body.confirmLoseDeposit) throw new BadRequestException('Đơn hủy trong vòng 12 giờ sẽ mất cọc. Hãy xác nhận confirmLoseDeposit.');
    const c=await this.db.pool.getConnection();try{await c.beginTransaction();
      const [brows]=await c.execute<any[]>("SELECT id,status FROM bookings WHERE id=? FOR UPDATE",[id]);if(!brows[0]||brows[0].status!=='DEPOSIT_PAID')throw new ConflictException('Booking đã thay đổi trạng thái.');
      const [payments]=await c.execute<any[]>("SELECT id,amount FROM payments WHERE bookingId=? AND status='SUCCEEDED' ORDER BY id LIMIT 1 FOR UPDATE",[id]);
      if(payments[0]){const [existingRefunds]=await c.execute<any[]>("SELECT id FROM refunds WHERE paymentId=? AND status IN ('REQUESTED','APPROVED','PAID') FOR UPDATE",[payments[0].id]);if(existingRefunds.length)throw new ConflictException('Booking đã có yêu cầu hoàn cọc hoặc đã hoàn tiền.');}
      if(preview.flow==='NEED_APPROVAL') {
        if(!payments[0]) throw new ConflictException('Không tìm thấy giao dịch cọc.');
        await c.execute(`INSERT INTO refunds(paymentId,amount,reason,status,requestedBy,bankName,accountNumber,accountName) VALUES (?,?,?,'REQUESTED',?,?,?,?)`,[payments[0].id,preview.refundAmount,`Hủy sân: ${String(body.reason||'Khách yêu cầu hủy sân')}`,userId,bankName,accountNumber,accountName]);
      } else {
        await c.execute("UPDATE bookings SET status='CANCELLED' WHERE id=?",[id]);
        await c.execute('DELETE FROM slot_occupancy WHERE bookingId=?',[id]);
      }
      if(preview.flow!=='NEED_APPROVAL'){
        await c.execute(`UPDATE inventory i JOIN (SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) qty FROM service_orders so JOIN service_order_items si ON si.orderId=so.id WHERE so.bookingId=? AND so.isDelivered=0 AND so.isRestocked=0 GROUP BY so.complexId,si.serviceId) x ON x.complexId=i.complexId AND x.serviceId=i.serviceId SET i.reserved=GREATEST(0,i.reserved-x.qty)`,[id]);
        await c.execute("UPDATE service_orders SET isRestocked=1,status='CANCELLED' WHERE bookingId=? AND isDelivered=0 AND isRestocked=0",[id]);
      }
      await c.commit();if(preview.flow!=='NEED_APPROVAL')await this.releaseBookingLock(id);await this.writeAudit(userId,'BOOKING_CANCEL_REQUESTED','BOOKING',id,{status:'DEPOSIT_PAID'},preview);return {data:{status:preview.flow==='NEED_APPROVAL'?'REFUND_REQUESTED':'CANCELLED',refundAmount:preview.refundAmount,flow:preview.flow}};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  }

  async qr(bookingId: number, userId: number) {
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT b.id,b.code,b.status,b.depositDue,b.expiresAt,b.customerId,ba.bankCode,ba.accountNumber,ba.accountName
       FROM bookings b JOIN pitches p ON p.id=b.pitchId
       LEFT JOIN bank_accounts ba ON ba.complexId=p.complexId AND ba.active=1
       WHERE b.id=? ORDER BY ba.id LIMIT 1`, [this.int(bookingId, 'Booking')]);
    const b = rows[0];
    if (!b || Number(b.customerId) !== userId) throw new NotFoundException('Không tìm thấy đơn đặt sân.');
    if (b.status !== 'PENDING_DEPOSIT' || !b.expiresAt || new Date(String(b.expiresAt).replace(' ', 'T') + 'Z').getTime() <= Date.now()) throw new ConflictException('Đơn không còn trong thời gian chờ cọc.');
    const bankCode = b.bankCode || process.env.DEMO_BANK_CODE || '970422';
    const accountNumber = b.accountNumber || process.env.DEMO_BANK_ACCOUNT || '1234567890';
    const accountName = b.accountName || process.env.DEMO_BANK_ACCOUNT_NAME || 'SPORTSPACE DEMO';
    const imageUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankCode)}-${encodeURIComponent(accountNumber)}-compact2.png?amount=${Number(b.depositDue)}&addInfo=${encodeURIComponent(b.code)}&accountName=${encodeURIComponent(accountName)}`;
    return { data: { bookingCode: b.code, bankCode, accountNumber, accountName, amount: Number(b.depositDue), description: b.code, qrImageUrl: imageUrl, expiresAt: b.expiresAt, demo: true } };
  }

  async demoPaid(bookingId: number, userId: number) {
    if (process.env.DEMO_PAYMENTS_ENABLED === 'false') throw new ConflictException('Chức năng thanh toán demo đã bị tắt.');
    const [rows] = await this.db.pool.execute<any[]>('SELECT b.code,b.depositDue,b.customerId,b.status FROM bookings b WHERE b.id=?', [this.int(bookingId, 'Booking')]);
    const b = rows[0];
    if (!b || Number(b.customerId) !== userId) throw new NotFoundException('Không tìm thấy đơn đặt sân.');
    if (b.status !== 'PENDING_DEPOSIT') throw new ConflictException('Đơn không ở trạng thái chờ cọc.');
    const payload = { eventId: `DEMO-${bookingId}-${Date.now()}`, transactionId: `DEMO-TXN-${Date.now()}`, amount: Number(b.depositDue), content: b.code, accountNumber: process.env.DEMO_BANK_ACCOUNT || '1234567890', paidAt: new Date().toISOString() };
    const raw = Buffer.from(JSON.stringify(payload));
    const secret = process.env.BANK_WEBHOOK_SECRET || 'demo-bank-webhook-secret-change-me-32';
    const signature = createHmac('sha256', secret).update(raw).digest('hex');
    return this.webhook(raw, payload, signature);
  }

  async webhook(rawBody: Buffer, payload: any, signature: string) {
    const secret = process.env.BANK_WEBHOOK_SECRET || 'demo-bank-webhook-secret-change-me-32';
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature, 'hex'); } catch { supplied = Buffer.alloc(0); }
    const valid = supplied.length === expected.length && timingSafeEqual(expected, supplied);
    const provider = valid ? 'DEMO_BANK' : 'UNVERIFIED_BANK';
    const eventId = String(payload?.eventId || 'MISSING_EVENT');
    if (eventId.length > 120) throw new BadRequestException('eventId quá dài.');
    try {
      await this.db.pool.execute(
        `INSERT INTO payment_events(provider,eventId,signatureValid,payload,status) VALUES (?,?,?,?,?)`,
        [provider, eventId, valid ? 1 : 0, JSON.stringify(payload ?? {}), valid ? 'RECEIVED' : 'REJECTED'],
      );
    } catch (error: any) {
      if (error?.code === 'ER_DUP_ENTRY') return { data: { accepted: true, duplicate: true } };
      throw error;
    }
    if (!valid) throw new UnauthorizedException('Chữ ký webhook không hợp lệ.');
    const amount = Number(payload?.amount);
    const content = String(payload?.content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const transactionId = String(payload?.transactionId || eventId);
    if (!Number.isSafeInteger(amount) || amount <= 0 || !content || transactionId.length > 120 || !payload?.accountNumber) {
      await this.db.pool.execute("UPDATE payment_events SET status='NEEDS_REVIEW' WHERE provider=? AND eventId=?", [provider,eventId]);
      return { data: { accepted: true, status: 'NEEDS_REVIEW', reason: 'Thiếu mã đơn, mã giao dịch, số tiền hoặc số tài khoản hợp lệ.' } };
    }
    const [bookings] = await this.db.pool.execute<any[]>(
      `SELECT b.id,b.code,b.depositDue,b.status,b.expiresAt,ba.accountNumber FROM bookings b JOIN pitches p ON p.id=b.pitchId LEFT JOIN bank_accounts ba ON ba.complexId=p.complexId AND ba.active=1 WHERE REPLACE(REPLACE(UPPER(b.code),'-',''),' ','')=? ORDER BY ba.id LIMIT 1`, [content]);
    const booking = bookings[0];
    if (!booking || booking.status !== 'PENDING_DEPOSIT' || !booking.expiresAt || new Date(String(booking.expiresAt).replace(' ', 'T') + 'Z').getTime() <= Date.now() || amount < Number(booking.depositDue) || (booking.accountNumber && String(payload.accountNumber || '') !== String(booking.accountNumber))) {
      await this.db.pool.execute("UPDATE payment_events SET status='NEEDS_REVIEW' WHERE provider=? AND eventId=?", [provider, eventId]);
      return { data: { accepted: true, status: 'NEEDS_REVIEW', reason: 'Không khớp đơn, sai tiền hoặc giao dịch đến muộn.' } };
    }
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [locked] = await c.execute<any[]>('SELECT * FROM bookings WHERE id=? FOR UPDATE', [booking.id]);
      if (!locked[0] || locked[0].status !== 'PENDING_DEPOSIT') throw new ConflictException('Booking đã được xử lý.');
      const reference = transactionId;
      const [payment] = await c.execute<any>(
        `INSERT INTO payments(bookingId,purpose,method,provider,providerReference,amount,status,paidAt) VALUES (?,'DEPOSIT','BANK_QR',?,?,?,'SUCCEEDED',UTC_TIMESTAMP())`,
        [booking.id, provider, reference, amount]);
      await c.execute("UPDATE bookings SET status='DEPOSIT_PAID',expiresAt=NULL WHERE id=?", [booking.id]);
      await c.execute("UPDATE slot_occupancy SET state='CONFIRMED',expiresAt=NULL WHERE bookingId=?", [booking.id]);
      await c.execute("UPDATE service_orders SET status='CONFIRMED' WHERE bookingId=? AND status='DRAFT'", [booking.id]);
      await c.execute("UPDATE payment_events SET status='PROCESSED',paymentId=? WHERE provider=? AND eventId=?", [payment.insertId, provider, eventId]);
      await c.execute("INSERT INTO notifications(userId,bookingId,title,content) SELECT customerId,id,'Đã nhận tiền cọc',CONCAT('Booking ',code,' đã được xác nhận.') FROM bookings WHERE id=? AND customerId IS NOT NULL", [booking.id]);
      await c.execute("INSERT INTO audit_logs(action,entityType,entityId,afterData) VALUES ('BANK_WEBHOOK_PROCESSED','PAYMENT',?,JSON_OBJECT('bookingId',?,'amount',?,'eventId',?))", [String(payment.insertId), booking.id, amount, eventId]);
      await c.commit();
      await this.releaseBookingLock(Number(booking.id));
      return { data: { accepted: true, status: 'PROCESSED', bookingId: Number(booking.id), paymentId: Number(payment.insertId) } };
    } catch (error: any) {
      await c.rollback();
      await this.db.pool.execute("UPDATE payment_events SET status='NEEDS_REVIEW' WHERE provider=? AND eventId=?", [provider,eventId]);
      if (error?.code === 'ER_DUP_ENTRY' || error instanceof ConflictException) {
        return { data: { accepted: true, status: 'NEEDS_REVIEW', reason: 'Giao dịch đã được ghi nhận hoặc booking vừa được xử lý; cần đối soát.' } };
      }
      throw error;
    } finally { c.release(); }
  }

  async matrix(date?: string, complexId?: number) {
    const day = date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Ngày không hợp lệ.');
    const args: any[] = [day];
    const complexFilter = complexId ? ' AND p.complexId=?' : '';
    if (complexId) args.push(this.int(complexId, 'Cụm sân'));
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT p.id pitchId,p.name pitchName,p.type,p.status pitchStatus,p.complexId,
       s.id slotId,s.start,s.end,b.id bookingId,b.code bookingCode,b.status bookingStatus,b.pitchAmount,b.depositDue,
       COALESCE((SELECT SUM(si.quantity*si.unitPrice) FROM service_orders so JOIN service_order_items si ON si.orderId=so.id WHERE so.bookingId=b.id),0) serviceAmount,
       COALESCE((SELECT SUM(py.amount) FROM payments py WHERE py.bookingId=b.id AND py.status='SUCCEEDED'),0) paidAmount,
       COALESCE(b.guestName,u.fullName) customerName,COALESCE(b.guestPhone,u.phone) customerPhone,b.source,
       o.state occupancyState,EXISTS(SELECT 1 FROM pitch_blocks pb WHERE pb.pitchId=p.id AND TIMESTAMP(?,s.start)<pb.endsAt AND TIMESTAMP(?,s.end)>pb.startsAt) blocked
       FROM pitches p JOIN slots s ON s.pitchId=p.id LEFT JOIN slot_occupancy o ON o.pitchId=p.id AND o.slotId=s.id AND o.date=?
       LEFT JOIN bookings b ON b.id=o.bookingId LEFT JOIN users u ON u.id=b.customerId
       WHERE 1=1 ${complexFilter} ORDER BY p.id,s.start`, [day, day, day, ...args.slice(1)]);
    const map = new Map<number, any>();
    for (const r of rows) {
      if (!map.has(Number(r.pitchId))) map.set(Number(r.pitchId), { id: Number(r.pitchId), name: r.pitchName, type: r.type, status: r.pitchStatus, complexId: Number(r.complexId), slots: [] });
      const slotIsPast = new Date(`${day}T${r.start}:00+07:00`).getTime() <= Date.now();
      const state = r.blocked || r.pitchStatus !== 'ACTIVE' ? 'MAINTENANCE' : r.bookingStatus === 'CHECKED_IN' ? 'IN_USE' : r.bookingStatus === 'DEPOSIT_PAID' ? 'DEPOSITED' : r.bookingStatus === 'PENDING_DEPOSIT' ? 'LOCKED' : slotIsPast ? 'MAINTENANCE' : 'AVAILABLE';
      map.get(Number(r.pitchId)).slots.push({ slotId: Number(r.slotId), start: r.start, end: r.end, state, bookingId: r.bookingId ? Number(r.bookingId) : null, bookingCode: r.bookingCode, bookingStatus: r.bookingStatus, pitchAmount: Number(r.pitchAmount||0), serviceAmount: Number(r.serviceAmount||0), depositDue: Number(r.depositDue||0), paidAmount: Number(r.paidAmount||0), customerName: r.customerName, customerPhone: r.customerPhone, source: r.source });
    }
    return { data: { date: day, updatedAt: new Date().toISOString(), pitches: [...map.values()] } };
  }

  async walkIn(body: any, userId: number) {
    const pitchId = this.int(body.pitchId, 'Sân'), slotId = this.int(body.slotId, 'Ca');
    const date = String(body.date || ''); const guestName = String(body.guestName || '').trim(); const guestPhone = String(body.guestPhone || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !guestName || guestName.length>120 || !/^0\d{9,10}$/.test(guestPhone)) throw new BadRequestException('Ngày, tên khách hoặc số điện thoại không hợp lệ.');
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [pitchRows] = await c.execute<any[]>('SELECT p.*,s.start,s.end FROM pitches p JOIN slots s ON s.pitchId=p.id WHERE p.id=? AND s.id=? FOR UPDATE', [pitchId, slotId]);
      const pitch = pitchRows[0]; if (!pitch || pitch.status !== 'ACTIVE') throw new ConflictException('Sân hoặc ca không khả dụng.');
      if (new Date(`${date}T${pitch.start}:00+07:00`).getTime() <= Date.now()) throw new ConflictException('Không thể tạo đơn cho ca đã bắt đầu hoặc đã qua.');
      const [occupied] = await c.execute<any[]>('SELECT bookingId FROM slot_occupancy WHERE pitchId=? AND slotId=? AND date=? FOR UPDATE', [pitchId, slotId, date]);
      if (occupied.length) throw new ConflictException('Ca vừa được người khác giữ hoặc đặt.');
      const [holidayRows]=await c.execute<any[]>('SELECT 1 FROM holidays WHERE date=? LIMIT 1',[date]);
      const dayType = holidayRows.length ? 'HOLIDAY' : ((new Date(`${date}T00:00:00Z`).getUTCDay() === 0 || new Date(`${date}T00:00:00Z`).getUTCDay() === 6) ? 'WEEKEND' : 'WEEKDAY');
      const [priceRows] = await c.execute<any[]>(`SELECT amount FROM prices WHERE pitchId=? AND dayType IN (?, 'HOLIDAY') AND start<=? AND end>=? ORDER BY dayType='HOLIDAY' DESC LIMIT 1`, [pitchId, dayType, pitch.end, pitch.start]);
      const pitchAmount = Number(priceRows[0]?.amount || 300000);
      if(body.services!==undefined&&!Array.isArray(body.services))throw new BadRequestException('Danh sách dịch vụ không hợp lệ.');
      const requestedServices = Array.isArray(body.services) ? body.services : [];
      if(requestedServices.length>30)throw new BadRequestException('Chỉ được chọn tối đa 30 dòng dịch vụ.');
      let serviceAmount = 0;
      const seenServices=new Set<number>();
      const serviceLines: Array<{serviceId:number;quantity:number;unitPrice:number;kind:string}> = [];
      for (const line of requestedServices) {
        const serviceId=this.int(line.serviceId,'Dịch vụ'), quantity=this.int(line.quantity,'Số lượng');
        if(quantity>100||seenServices.has(serviceId))throw new BadRequestException('Số lượng mỗi dịch vụ tối đa 100 và không được chọn trùng.');
        seenServices.add(serviceId);
        const [inventoryRows]=await c.execute<any[]>(`SELECT i.quantity,i.reserved,s.price,s.kind FROM inventory i JOIN services s ON s.id=i.serviceId WHERE i.complexId=? AND i.serviceId=? AND s.active=1 FOR UPDATE`,[pitch.complexId,serviceId]);
        const inv=inventoryRows[0]; if(!inv||Number(inv.quantity)-Number(inv.reserved)<quantity) throw new ConflictException(`Dịch vụ ${serviceId} không đủ tồn kho.`);
        serviceLines.push({serviceId,quantity,unitPrice:Number(inv.price),kind:inv.kind}); serviceAmount+=Number(inv.price)*quantity;
        if(!Number.isSafeInteger(serviceAmount))throw new BadRequestException('Tổng tiền dịch vụ vượt giới hạn.');
      }
      const totalAmount=pitchAmount+serviceAmount;if(!Number.isSafeInteger(totalAmount)||totalAmount>2147483647)throw new BadRequestException('Tổng tiền đơn vượt giới hạn.');
      const code = this.code('WI');
      const [insert] = await c.execute<any>(`INSERT INTO bookings(code,pitchId,slotId,date,guestName,guestPhone,createdBy,source,status,pitchAmount,serviceAmount,depositDue) VALUES (?,?,?,?,?,?,?,'WALK_IN','CHECKED_IN',?,?,?)`, [code,pitchId,slotId,date,guestName,guestPhone,userId,pitchAmount,serviceAmount,pitchAmount]);
      const bookingId = Number(insert.insertId);
      await c.execute(`INSERT INTO slot_occupancy(pitchId,slotId,date,bookingId,state,expiresAt) VALUES (?,?,?,?,'CONFIRMED',NULL)`, [pitchId,slotId,date,bookingId]);
      if(serviceLines.length){const [order]=await c.execute<any>(`INSERT INTO service_orders(bookingId,complexId,createdBy,status,isDelivered) VALUES (?,?,?,'PAID',TRUE)`,[bookingId,pitch.complexId,userId]);for(const line of serviceLines){await c.execute('INSERT INTO service_order_items(orderId,serviceId,quantity,unitPrice) VALUES (?,?,?,?)',[order.insertId,line.serviceId,line.quantity,line.unitPrice]);if(line.kind==='SALE'){await c.execute('UPDATE inventory SET quantity=quantity-? WHERE complexId=? AND serviceId=?',[line.quantity,pitch.complexId,line.serviceId]);await c.execute("INSERT INTO stock_movements(complexId,serviceId,delta,kind,note,createdBy) VALUES (?,?,?,'SALE','Bán kèm đơn tại quầy',?)",[pitch.complexId,line.serviceId,-line.quantity,userId]);}else{await c.execute('UPDATE inventory SET reserved=reserved+? WHERE complexId=? AND serviceId=?',[line.quantity,pitch.complexId,line.serviceId]);await c.execute("INSERT INTO stock_movements(complexId,serviceId,delta,kind,note,createdBy) VALUES (?,?,?,'RENT_OUT','Cho thuê kèm đơn tại quầy',?)",[pitch.complexId,line.serviceId,-line.quantity,userId]);}}}
      await c.execute(`INSERT INTO payments(bookingId,purpose,method,provider,providerReference,amount,status,paidAt,receivedBy) VALUES (?,'SETTLEMENT',? , 'DEMO_CASHIER',?,?, 'SUCCEEDED',UTC_TIMESTAMP(),?)`, [bookingId, body.payMethod === 'BANK_QR' ? 'BANK_QR' : 'CASH', `WALKIN-${bookingId}-${Date.now()}`, totalAmount, userId]);
      await c.execute('UPDATE bookings SET checkedInAt=UTC_TIMESTAMP() WHERE id=?', [bookingId]);
      await c.execute("INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'BOOKING_WALK_IN_CREATED','BOOKING',?,JSON_OBJECT('code',?,'amount',?,'serviceAmount',?))", [userId,String(bookingId),code,totalAmount,serviceAmount]);
      await c.commit(); return { data: { id: bookingId, code, status: 'CHECKED_IN', amount: totalAmount } };
    } catch (e) { await c.rollback(); throw e; } finally { c.release(); }
  }

  async checkIn(id: number, body: any, userId: number) {
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.execute<any[]>('SELECT * FROM bookings WHERE id=? FOR UPDATE', [this.int(id,'Booking')]); const b=rows[0];
      if (!b) throw new NotFoundException('Không tìm thấy booking.'); if (b.status !== 'DEPOSIT_PAID') throw new ConflictException('Chỉ check-in đơn đã cọc.');
      const [paidRows] = await c.execute<any[]>('SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE bookingId=? AND status=\'SUCCEEDED\'', [id]);
      const [serviceRows] = await c.execute<any[]>('SELECT COALESCE(SUM(si.quantity*si.unitPrice),0) serviceTotal FROM service_orders so JOIN service_order_items si ON si.orderId=so.id WHERE so.bookingId=?', [id]);
      const total = Number(b.pitchAmount) + Number(serviceRows[0].serviceTotal); const due = Math.max(0,total-Number(paidRows[0].paid));
      const amount = this.int(body.collectAmount, 'Số tiền thu', 0); if (amount !== due) throw new BadRequestException(`Số tiền còn phải thu là ${due} đồng.`);
      if (amount > 0) await c.execute(`INSERT INTO payments(bookingId,purpose,method,provider,providerReference,amount,status,paidAt,receivedBy) VALUES (?,'SETTLEMENT',?,'DEMO_CASHIER',?,?,'SUCCEEDED',UTC_TIMESTAMP(),?)`, [id,body.method==='BANK_QR'?'BANK_QR':'CASH',`SETTLE-${id}-${Date.now()}`,amount,userId]);
      const [rentals] = await c.execute<any[]>(`SELECT so.complexId,si.serviceId,si.quantity FROM service_orders so JOIN service_order_items si ON si.orderId=so.id JOIN services s ON s.id=si.serviceId WHERE so.bookingId=? AND so.status='CONFIRMED' AND s.kind='RENTAL'`, [id]);
      for (const rental of rentals) await c.execute("INSERT INTO stock_movements(complexId,serviceId,delta,kind,note,createdBy) VALUES (?,?,?,'RENT_OUT','Cho thuê tại check-in',?)", [rental.complexId,rental.serviceId,-rental.quantity,userId]);
      await c.execute("UPDATE bookings SET status='CHECKED_IN',checkedInAt=UTC_TIMESTAMP() WHERE id=?", [id]);
      await c.execute("INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'BOOKING_CHECKED_IN','BOOKING',?,JSON_OBJECT('collected',?))", [userId,String(id),amount]);
      await c.commit(); return { data: { id, status: 'CHECKED_IN', collected: amount } };
    } catch(e) { await c.rollback(); throw e; } finally { c.release(); }
  }
  async complete(id: number, userId: number) {
    const c=await this.db.pool.getConnection();
    try{await c.beginTransaction();const [rows]=await c.execute<any[]>('SELECT status FROM bookings WHERE id=? FOR UPDATE',[this.int(id,'Booking')]);
      if(!rows[0])throw new NotFoundException('Không tìm thấy booking.');if(rows[0].status!=='CHECKED_IN')throw new ConflictException('Chỉ hoàn thành đơn đang sử dụng sân.');
      const [items]=await c.execute<any[]>(`SELECT so.id orderId,so.complexId,so.isDelivered,so.isRestocked,si.serviceId,si.quantity,s.kind FROM service_orders so JOIN service_order_items si ON si.orderId=so.id JOIN services s ON s.id=si.serviceId WHERE so.bookingId=? AND so.status IN ('CONFIRMED','PAID') FOR UPDATE`,[id]);
      for(const item of items){if(item.isRestocked||(item.isDelivered&&item.kind==='SALE'))continue;await c.execute('UPDATE inventory SET reserved=GREATEST(0,reserved-?) , quantity=IF(?=\'SALE\',quantity-?,quantity) WHERE complexId=? AND serviceId=?',[item.quantity,item.kind,item.quantity,item.complexId,item.serviceId]);if(item.kind==='SALE')await c.execute("INSERT INTO stock_movements(complexId,serviceId,delta,kind,note,createdBy) VALUES (?,?,?,'SALE','Sử dụng dịch vụ booking',?)",[item.complexId,item.serviceId,-item.quantity,userId]);else await c.execute("INSERT INTO stock_movements(complexId,serviceId,delta,kind,note,createdBy) VALUES (?,?,?,'RENT_RETURN','Hoàn trả dịch vụ thuê',?)",[item.complexId,item.serviceId,item.quantity,userId]);}
      await c.execute("UPDATE service_orders SET status='PAID',isDelivered=TRUE WHERE bookingId=? AND status='CONFIRMED'",[id]);
      await c.execute("UPDATE bookings SET status='COMPLETED',completedAt=UTC_TIMESTAMP() WHERE id=?",[id]);
      await c.execute('DELETE FROM slot_occupancy WHERE bookingId=?',[id]);
      await c.execute("INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'BOOKING_COMPLETED','BOOKING',?,JSON_OBJECT('status','COMPLETED'))",[userId,String(id)]);
      await c.commit();return {data:{id,status:'COMPLETED'}};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  }

  async services(complexId?: number) {
    const [rows] = await this.db.pool.execute<any[]>(`SELECT s.id serviceId,s.name,s.kind,s.unit,s.price,s.active,i.complexId,i.quantity stockQuantity,i.reserved,i.minQuantity minThreshold,(i.quantity-i.reserved) available,CASE WHEN i.quantity-i.reserved=0 THEN 'OUT_OF_STOCK' WHEN i.quantity-i.reserved<=i.minQuantity THEN 'LOW_STOCK' ELSE 'IN_STOCK' END status FROM services s JOIN inventory i ON i.serviceId=s.id ${complexId ? 'WHERE i.complexId=?' : ''} ORDER BY s.name`, complexId ? [this.int(complexId,'Cụm sân')] : []);
    return { data: rows };
  }
  async stockMovements(complexId?:number){
    const [rows]=await this.db.pool.execute<any[]>(`SELECT m.id,m.delta,m.kind,m.unitCost,m.note,m.createdAt,s.name serviceName,s.unit,c.name complexName,u.fullName createdByName FROM stock_movements m JOIN services s ON s.id=m.serviceId JOIN complexes c ON c.id=m.complexId LEFT JOIN users u ON u.id=m.createdBy ${complexId?'WHERE m.complexId=?':''} ORDER BY m.createdAt DESC LIMIT 100`,complexId?[this.int(complexId,'Cụm sân')]:[]);
    return {data:rows};
  }

  async addService(body: any, userId: number) {
    const name=String(body.name||'').trim(), unit=String(body.unit||'').trim(), price=this.int(body.price,'Giá',0), min=this.int(body.minThreshold??0,'Ngưỡng tồn kho',0);
    if (!name || !unit || !['SALE','RENTAL'].includes(body.kind)) throw new BadRequestException('Tên, đơn vị hoặc loại dịch vụ không hợp lệ.');
    const c=await this.db.pool.getConnection(); try { await c.beginTransaction();
      const [s]=await c.execute<any>(`INSERT INTO services(name,kind,unit,price,active) VALUES (?,?,?,?,1)`,[name,body.kind,unit,price]);
      await c.execute(`INSERT INTO inventory(complexId,serviceId,quantity,reserved,minQuantity) SELECT id,?,0,0,? FROM complexes`,[s.insertId,min]);
      await c.commit(); await this.writeAudit(userId,'SERVICE_CREATED','SERVICE',s.insertId,null,{name,unit,price}); return {data:{id:s.insertId,name}};
    } catch(e){await c.rollback();throw e;} finally{c.release();}
  }
  async editService(id:number, body:any,userId:number) {
    const name=String(body.name||'').trim(), price=this.int(body.price,'Giá',0), min=this.int(body.minThreshold??0,'Ngưỡng tồn kho',0);
    if (!name) throw new BadRequestException('Tên dịch vụ không được để trống.');
    const serviceId=this.int(id,'Dịch vụ');const [existing]=await this.db.pool.execute<any[]>('SELECT id FROM services WHERE id=?',[serviceId]);if(!existing[0])throw new NotFoundException('Không tìm thấy dịch vụ.');
    await this.db.pool.execute('UPDATE services SET name=?,price=?,active=? WHERE id=?',[name,price,body.active===false?0:1,serviceId]);
    await this.db.pool.execute('UPDATE inventory SET minQuantity=? WHERE serviceId=?',[min,id]); await this.writeAudit(userId,'SERVICE_UPDATED','SERVICE',id,null,body); return {data:{id}};
  }
  async stockMovement(body:any,userId:number,kind:'RECEIPT'|'LOSS') {
    const complexId=this.int(body.complexId,'Cụm sân'), serviceId=this.int(body.serviceId,'Dịch vụ'), quantity=this.int(body.quantity,'Số lượng');
    const reason=String(body.reason||'').trim(); if(reason.length>255)throw new BadRequestException('Lý do tối đa 255 ký tự.'); if(kind==='LOSS'&&!reason) throw new BadRequestException('Phiếu hao hụt bắt buộc có lý do.');
    const cost=kind==='RECEIPT'?this.int(body.costPrice??0,'Giá nhập',0):0; const c=await this.db.pool.getConnection();
    try{await c.beginTransaction(); const [r]=await c.execute<any[]>('SELECT quantity,reserved FROM inventory WHERE complexId=? AND serviceId=? FOR UPDATE',[complexId,serviceId]);
      if(!r[0]) throw new NotFoundException('Không tìm thấy mặt hàng trong kho cụm sân.');
      if(kind==='LOSS'&&Number(r[0].quantity)-Number(r[0].reserved)<quantity) throw new ConflictException('Tồn khả dụng không đủ để ghi nhận hao hụt.');
      await c.execute('UPDATE inventory SET quantity=quantity+? WHERE complexId=? AND serviceId=?',[kind==='RECEIPT'?quantity:-quantity,complexId,serviceId]);
      await c.execute('INSERT INTO stock_movements(complexId,serviceId,delta,kind,unitCost,note,createdBy) VALUES (?,?,?,?,?,?,?)',[complexId,serviceId,kind==='RECEIPT'?quantity:-quantity,kind,cost,reason||'Nhập kho',userId]);
      await c.commit(); await this.writeAudit(userId,kind==='RECEIPT'?'STOCK_RECEIPT':'STOCK_LOSS','SERVICE',serviceId,null,{complexId,quantity,reason}); return {data:{success:true}};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  }

  async holidays(){const [r]=await this.db.pool.execute<any[]>('SELECT DATE_FORMAT(date,\'%Y-%m-%d\') date,name FROM holidays ORDER BY date');return {data:r};}
  async addHoliday(body:any,userId:number){const date=String(body.date||''),name=String(body.name||'').trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!name)throw new BadRequestException('Ngày lễ hoặc tên ngày lễ không hợp lệ.');await this.db.pool.execute('INSERT INTO holidays(date,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)',[date,name]);await this.writeAudit(userId,'HOLIDAY_CREATED','HOLIDAY',date,null,{name});return {data:{date,name}};}
  async deleteHoliday(date:string,userId:number){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date)))throw new BadRequestException('Ngày lễ không hợp lệ.');await this.db.pool.execute('DELETE FROM holidays WHERE date=?',[date]);await this.writeAudit(userId,'HOLIDAY_DELETED','HOLIDAY',date);return {data:{date,deleted:true}};}

  async prices(id:number) { const [r]=await this.db.pool.execute<any[]>('SELECT * FROM prices WHERE pitchId=? ORDER BY dayType,start',[this.int(id,'Sân')]); return {data:r}; }
  async savePrices(id:number, prices:any[],userId:number) {
    if(!Array.isArray(prices)||!prices.length) throw new BadRequestException('Cần ít nhất một khung giá.');
    for(const p of prices){if(!['WEEKDAY','WEEKEND','HOLIDAY'].includes(p.dayType)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.end)||p.start>=p.end||!Number.isSafeInteger(Number(p.amount))||Number(p.amount)<=0||!Number.isInteger(Number(p.depositPercent))||p.depositPercent<1||p.depositPercent>100) throw new BadRequestException('Dòng giá không hợp lệ.');}
    for(const dayType of ['WEEKDAY','WEEKEND','HOLIDAY']){const group=prices.filter(p=>p.dayType===dayType).sort((a,b)=>a.start.localeCompare(b.start));for(let i=1;i<group.length;i++)if(group[i].start<group[i-1].end)throw new BadRequestException(`Khung ${group[i-1].start}-${group[i-1].end} chồng với ${group[i].start}-${group[i].end} (${dayType}).`);}
    const c=await this.db.pool.getConnection();try{await c.beginTransaction();await c.execute('SELECT id FROM pitches WHERE id=? FOR UPDATE',[id]);const [old]=await c.execute<any[]>('SELECT dayType,start,end,amount,depositPercent FROM prices WHERE pitchId=? FOR UPDATE',[id]);await c.execute('DELETE FROM prices WHERE pitchId=?',[id]);for(const p of prices)await c.execute('INSERT INTO prices(pitchId,dayType,`start`,`end`,amount,depositPercent) VALUES (?,?,?,?,?,?)',[id,p.dayType,p.start,p.end,Number(p.amount),Number(p.depositPercent)]);await c.commit();await this.writeAudit(userId,'PRICE_CHANGED','PITCH',id,old,prices);return {data:{saved:prices.length,warnings:[]}};}catch(e){await c.rollback();throw e;}finally{c.release();}
  }
  async maintenancePreview(id:number,body:any){const [r]=await this.db.pool.execute<any[]>(`SELECT b.id,b.code,b.status,b.date,b.pitchId,b.slotId,s.start,s.end FROM bookings b JOIN slots s ON s.id=b.slotId WHERE b.pitchId=? AND b.date BETWEEN DATE(?) AND DATE(?) AND b.status IN ('PENDING_DEPOSIT','DEPOSIT_PAID','CHECKED_IN')`,[id,body.from,body.to]);const active=r.find((b:any)=>b.status==='CHECKED_IN');if(active)throw new ConflictException(`Đơn ${active.code} đang sử dụng sân. Hãy hoàn thành hoặc xử lý đơn này trước khi tạo lịch bảo trì.`);return {data:r};}
  async maintenance(id: number, body: any, userId: number) {
    const from = String(body.from || '');
    const to = String(body.to || '');
    const reason = String(body.reason || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to || !reason || reason.length > 255) {
      throw new BadRequestException('Khoảng ngày hoặc lý do bảo trì không hợp lệ.');
    }

    const connection = await this.db.pool.getConnection();
    let affectedBookings: any[] = [];
    try {
      await connection.beginTransaction();
      const [pitchRows] = await connection.execute<any[]>('SELECT id,type FROM pitches WHERE id=? FOR UPDATE', [this.int(id, 'Sân')]);
      if (!pitchRows[0]) throw new NotFoundException('Không tìm thấy sân.');
      const [existingBlocks] = await connection.execute<any[]>(
        `SELECT id FROM pitch_blocks WHERE pitchId=?
         AND startsAt<DATE_ADD(TIMESTAMP(?,'00:00:00'),INTERVAL 1 DAY)
         AND endsAt>TIMESTAMP(?,'00:00:00') FOR UPDATE`, [id, to, from]);
      if (existingBlocks.length) throw new ConflictException('Khoảng thời gian này đã có lịch bảo trì.');

      const [bookings] = await connection.execute<any[]>(
        `SELECT b.id,b.code,b.status,b.date,b.pitchId,b.slotId,s.start,s.end
         FROM bookings b JOIN slots s ON s.id=b.slotId
         WHERE b.pitchId=? AND b.date BETWEEN ? AND ?
           AND b.status IN ('PENDING_DEPOSIT','DEPOSIT_PAID','CHECKED_IN')
         FOR UPDATE`, [id, from, to]);
      affectedBookings = bookings;
      const activeBooking = bookings.find((booking: any) => booking.status === 'CHECKED_IN');
      if (activeBooking) throw new ConflictException(`Đơn ${activeBooking.code} đang sử dụng sân. Hãy hoàn thành hoặc xử lý đơn này trước khi tạo lịch bảo trì.`);
      const impacted = bookings.filter((booking: any) => booking.status !== 'PENDING_DEPOSIT');
      const resolutions = Array.isArray(body.resolutions) ? body.resolutions : [];
      for (const booking of impacted) {
        const resolution = resolutions.find((item: any) => Number(item.bookingId) === Number(booking.id));
        if (!resolution || !['MOVE', 'REFUND'].includes(resolution.action)) {
          throw new BadRequestException(`Cần chọn MOVE hoặc REFUND cho booking ${booking.code}.`);
        }
      }

      for (const booking of bookings) {
        if (booking.status === 'PENDING_DEPOSIT') {
          await connection.execute("UPDATE bookings SET status='CANCELLED' WHERE id=?", [booking.id]);
          await connection.execute('DELETE FROM slot_occupancy WHERE bookingId=?', [booking.id]);
          continue;
        }

        const resolution = resolutions.find((item: any) => Number(item.bookingId) === Number(booking.id));
        if (resolution.action === 'MOVE') {
          if (booking.status !== 'DEPOSIT_PAID') {
            throw new ConflictException(`Booking ${booking.code} đã check-in nên không thể chuyển sân.`);
          }
          const targetPitchId = this.int(resolution.targetPitchId, 'Sân thay thế');
          const [targetSlots] = await connection.execute<any[]>(
            `SELECT s.id,p.complexId,p.type FROM slots s JOIN pitches p ON p.id=s.pitchId
             WHERE p.id=? AND p.status='ACTIVE' AND p.type=? AND s.start=? AND s.end=?
               AND NOT EXISTS (SELECT 1 FROM pitch_blocks pb WHERE pb.pitchId=p.id AND TIMESTAMP(?,s.start)<pb.endsAt AND TIMESTAMP(?,s.end)>pb.startsAt)
             LIMIT 1 FOR UPDATE`,
            [targetPitchId, pitchRows[0].type, booking.start, booking.end, booking.date, booking.date]);
          if (!targetSlots[0]) throw new ConflictException(`Sân thay thế không có ca cùng giờ hoặc đang bảo trì cho ${booking.code}.`);
          const [holidayRows] = await connection.execute<any[]>('SELECT 1 FROM holidays WHERE date=? LIMIT 1', [booking.date]);
          const weekday = new Date(`${String(booking.date).slice(0,10)}T00:00:00Z`).getUTCDay();
          const dayType = holidayRows.length ? 'HOLIDAY' : (weekday===0||weekday===6?'WEEKEND':'WEEKDAY');
          const [targetPrices] = await connection.execute<any[]>(`SELECT amount FROM prices WHERE pitchId=? AND dayType=? AND start<=? AND end>=? LIMIT 1`, [targetPitchId,dayType,booking.end,booking.start]);
          if (!targetPrices[0] || Number(targetPrices[0].amount)!==Number(booking.pitchAmount)) {
            throw new ConflictException('Sân thay thế phải có cùng giá/ca để chuyển booking mà không phát sinh thu hoặc hoàn thêm.');
          }

          const [targetOccupancy] = await connection.execute<any[]>(
            'SELECT bookingId FROM slot_occupancy WHERE pitchId=? AND slotId=? AND date=? FOR UPDATE',
            [targetPitchId, targetSlots[0].id, booking.date]);
          if (targetOccupancy.length) throw new ConflictException(`Sân thay thế đã kín ca cho ${booking.code}.`);

          const [serviceCount] = await connection.execute<any[]>(
            'SELECT COUNT(*) total FROM service_order_items si JOIN service_orders so ON so.id=si.orderId WHERE so.bookingId=?',
            [booking.id]);
          if (Number(serviceCount[0].total) > 0) {
            throw new ConflictException('Bản demo chỉ chuyển sân cho booking không kèm dịch vụ.');
          }

          await connection.execute('DELETE FROM slot_occupancy WHERE bookingId=?', [booking.id]);
          await connection.execute('UPDATE bookings SET pitchId=?,slotId=? WHERE id=?', [targetPitchId, targetSlots[0].id, booking.id]);
          await connection.execute(
            "INSERT INTO slot_occupancy(pitchId,slotId,date,bookingId,state,expiresAt) VALUES (?,?,?,?,'CONFIRMED',NULL)",
            [targetPitchId, targetSlots[0].id, booking.date, booking.id]);
        } else {
          const amount = this.int(resolution.refundAmount, 'Số tiền hoàn');
          const [paymentRows] = await connection.execute<any[]>(
            "SELECT id,amount FROM payments WHERE bookingId=? AND status='SUCCEEDED' ORDER BY id LIMIT 1 FOR UPDATE",
            [booking.id]);
          if (!paymentRows[0] || amount > Number(paymentRows[0].amount)) {
            throw new BadRequestException(`Số tiền hoàn đơn ${booking.code} vượt tiền đã thu.`);
          }
          const [existingRefunds] = await connection.execute<any[]>(
            "SELECT id FROM refunds WHERE paymentId=? AND status IN ('REQUESTED','APPROVED','PAID') FOR UPDATE",
            [paymentRows[0].id]);
          if (existingRefunds.length) throw new ConflictException(`Booking ${booking.code} đã có yêu cầu hoàn cọc.`);

          const bankName=String(resolution.bankName||'').trim(),accountNumber=String(resolution.accountNumber||'').trim(),accountName=String(resolution.accountName||'').trim();
          if(!bankName||!accountNumber||!accountName)throw new BadRequestException(`Cần thông tin tài khoản hoàn cọc của đơn ${booking.code}.`);
          await connection.execute(
            `INSERT INTO refunds(paymentId,amount,reason,status,requestedBy,bankName,accountNumber,accountName)
             VALUES (?,?,?,'REQUESTED',?,?,?,?)`,
            [paymentRows[0].id, amount, `Bảo trì sân: ${reason}`, userId, bankName, accountNumber, accountName]);
        }
      }

      await connection.execute(
        `UPDATE inventory i JOIN (
           SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) qty
           FROM service_orders so JOIN service_order_items si ON si.orderId=so.id
           WHERE so.bookingId IN (SELECT id FROM bookings WHERE pitchId=? AND date BETWEEN ? AND ? AND status='CANCELLED')
             AND so.isDelivered=0 AND so.isRestocked=0
           GROUP BY so.complexId,si.serviceId
         ) x ON x.complexId=i.complexId AND x.serviceId=i.serviceId
         SET i.reserved=GREATEST(0,i.reserved-x.qty)`, [id, from, to]);
      await connection.execute(
        `UPDATE inventory i JOIN (
           SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) qty
           FROM service_orders so JOIN service_order_items si ON si.orderId=so.id
           JOIN services s ON s.id=si.serviceId
           WHERE so.bookingId IN (SELECT id FROM bookings WHERE pitchId=? AND date BETWEEN ? AND ? AND status='CANCELLED')
             AND so.isDelivered=1 AND so.isRestocked=0 AND s.kind='RENTAL'
           GROUP BY so.complexId,si.serviceId
         ) x ON x.complexId=i.complexId AND x.serviceId=i.serviceId
         SET i.reserved=GREATEST(0,i.reserved-x.qty)`, [id, from, to]);
      for (const booking of bookings.filter((item: any) => item.status === 'CHECKED_IN')) {
        const [rentals] = await connection.execute<any[]>(`SELECT so.complexId,si.serviceId,si.quantity FROM service_orders so JOIN service_order_items si ON si.orderId=so.id JOIN services s ON s.id=si.serviceId WHERE so.bookingId=? AND s.kind='RENTAL'`, [booking.id]);
        for (const rental of rentals) await connection.execute("INSERT INTO stock_movements(complexId,serviceId,delta,kind,note,createdBy) VALUES (?,?,?,'RENT_RETURN','Hoàn trả khi bảo trì sân',?)", [rental.complexId,rental.serviceId,rental.quantity,userId]);
      }
      await connection.execute(
        `UPDATE service_orders SET status='CANCELLED',isRestocked=1
         WHERE bookingId IN (SELECT id FROM bookings WHERE pitchId=? AND date BETWEEN ? AND ? AND status='CANCELLED')
           AND isRestocked=0`, [id, from, to]);
      await connection.execute(
        `INSERT INTO pitch_blocks(pitchId,startsAt,endsAt,reason)
         VALUES (?,TIMESTAMP(?,'00:00:00'),DATE_ADD(TIMESTAMP(?,'00:00:00'),INTERVAL 1 DAY),?)`,
        [id, from, to, reason]);

      await connection.commit();
      for (const booking of affectedBookings) {
        await this.redis.release(
          `booking:slot:${booking.pitchId}:${booking.slotId}:${String(booking.date).slice(0, 10)}`,
          `booking:${booking.id}`);
      }
      await this.writeAudit(userId, 'PITCH_MAINTENANCE', 'PITCH', id, null, { from, to, reason });
      return { data: { success: true, affected: affectedBookings.length } };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async report(from:string,to:string,groupBy:string){if(!this.validDate(from)||!this.validDate(to)||from>to||Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z')>365*86400000)throw new BadRequestException('Khoảng ngày không hợp lệ hoặc dài quá 366 ngày.');if(!['day','week','month','year'].includes(groupBy))throw new BadRequestException('Kiểu nhóm không hợp lệ.');
    const [kpiRows]=await this.db.pool.execute<any[]>(`SELECT (SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='SUCCEEDED' AND DATE(paidAt + INTERVAL 7 HOUR) BETWEEN ? AND ?) grossRevenue,(SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='SUCCEEDED' AND DATE(paidAt + INTERVAL 7 HOUR) BETWEEN ? AND ?)-(SELECT COALESCE(SUM(amount),0) FROM refunds WHERE status='PAID' AND DATE(paidAt + INTERVAL 7 HOUR) BETWEEN ? AND ?) netRevenue,(SELECT COUNT(*) FROM bookings WHERE date BETWEEN ? AND ? AND status IN ('DEPOSIT_PAID','CHECKED_IN','COMPLETED')) totalBookings,(SELECT COUNT(*) FROM bookings WHERE date BETWEEN ? AND ? AND status='PENDING_DEPOSIT') pendingBookings`,[from,to,from,to,from,to,from,to,from,to]);
    const [byStatus]=await this.db.pool.execute<any[]>(`SELECT status,COUNT(*) total FROM bookings WHERE date BETWEEN ? AND ? GROUP BY status`,[from,to]);
    const bucketExpr=groupBy==='week'?"DATE_FORMAT(paidAt + INTERVAL 7 HOUR,'%x-W%v')":groupBy==='month'?"DATE_FORMAT(paidAt + INTERVAL 7 HOUR,'%Y-%m')":groupBy==='year'?'YEAR(paidAt + INTERVAL 7 HOUR)':'DATE(paidAt + INTERVAL 7 HOUR)';
    const [series]=await this.db.pool.execute<any[]>(`SELECT ${bucketExpr} bucket,SUM(amount) grossRevenue,COUNT(*) payments FROM payments WHERE status='SUCCEEDED' AND DATE(paidAt + INTERVAL 7 HOUR) BETWEEN ? AND ? GROUP BY bucket ORDER BY bucket`,[from,to]);
    const [capacityRows]=await this.db.pool.execute<any[]>("WITH RECURSIVE days AS (SELECT CAST(? AS DATE) d UNION ALL SELECT d + INTERVAL 1 DAY FROM days WHERE d < ?) SELECT COUNT(*) total FROM days JOIN slots s JOIN pitches p ON p.id=s.pitchId AND p.status='ACTIVE' WHERE NOT EXISTS (SELECT 1 FROM pitch_blocks pb WHERE pb.pitchId=p.id AND TIMESTAMP(days.d,s.start)<pb.endsAt AND TIMESTAMP(days.d,s.end)>pb.startsAt)",[from,to]);
    const [usedRows]=await this.db.pool.execute<any[]>("SELECT COUNT(*) total FROM bookings WHERE date BETWEEN ? AND ? AND status IN ('DEPOSIT_PAID','CHECKED_IN','COMPLETED')",[from,to]);
    const available=Number(capacityRows[0].total);
    const kpi=kpiRows[0];
    const [serviceRows]=await this.db.pool.execute<any[]>("SELECT COALESCE(SUM(CASE WHEN py.serviceOrderId IS NOT NULL OR py.purpose='SERVICE' THEN py.amount WHEN py.bookingId IS NOT NULL THEN py.amount*COALESCE(b.serviceAmount,0)/NULLIF(b.pitchAmount+COALESCE(b.serviceAmount,0),0) ELSE 0 END),0) serviceRevenue FROM payments py LEFT JOIN bookings b ON b.id=py.bookingId WHERE py.status='SUCCEEDED' AND DATE(py.paidAt + INTERVAL 7 HOUR) BETWEEN ? AND ?",[from,to]);
    const grossRevenue=Number(kpi.grossRevenue||0);
    const serviceRevenue=Math.min(grossRevenue,Math.max(0,Math.round(Number(serviceRows[0].serviceRevenue||0))));
    return {data:{netRevenue:Number(kpi.netRevenue),grossRevenue,totalBookings:Number(kpi.totalBookings),pendingBookings:Number(kpi.pendingBookings),pitchRevenue:grossRevenue-serviceRevenue,serviceRevenue,byStatus,series,fillingRate:available?Math.min(100,Math.round(Number(usedRows[0].total)/available*10000)/100):0,from,to,groupBy,notes:'Doanh thu sân/dịch vụ là số tiền đã thu trước hoàn, phân bổ theo tỷ trọng tiền sân và dịch vụ trong từng booking. Tiền hoàn được trừ ở doanh thu ròng.'}};
  }
  async exportCsv(from:string,to:string,groupBy:string){const report=(await this.report(from,to,groupBy)).data;const lines=[['Chi so','Gia tri'],['Tu ngay',from],['Den ngay',to],['Doanh thu rong',report.netRevenue],['Doanh thu thu vao',report.grossRevenue],['Tong don hop le',report.totalBookings],['Ty le lap day (%)',report.fillingRate],['Doanh thu san',report.pitchRevenue],['Doanh thu dich vu',report.serviceRevenue],[],['Ngay','Doanh thu','So giao dich'],...report.series.map((x:any)=>[String(x.bucket),x.grossRevenue,x.payments])];return lines.map((row:any[])=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  async listAudit(filters:{page:number;action?:string;actorId?:number;entityType?:string;from?:string;to?:string}){
    const {page,action,actorId,entityType,from,to}=filters;
    if(!Number.isSafeInteger(page)||page<1)throw new BadRequestException('Số trang không hợp lệ.');
    if(actorId!==undefined&&(!Number.isSafeInteger(actorId)||actorId<1))throw new BadRequestException('Mã người thực hiện không hợp lệ.');
    if((action&&action.length>100)||(entityType&&entityType.length>80))throw new BadRequestException('Bộ lọc quá dài.');
    if((from&&!this.validDate(from))||(to&&!this.validDate(to))||(from&&to&&from>to))throw new BadRequestException('Khoảng ngày không hợp lệ.');
    const where:string[]=[],args:(string|number)[]=[];
    if(action){where.push('a.action=?');args.push(action.trim());}
    if(actorId!==undefined){where.push('a.actorId=?');args.push(actorId);}
    if(entityType){where.push('a.entityType=?');args.push(entityType.trim());}
    if(from){where.push('a.createdAt>=?');args.push(new Date(`${from}T00:00:00+07:00`).toISOString().slice(0,19).replace('T',' '));}
    if(to){where.push('a.createdAt<?');args.push(new Date(new Date(`${to}T00:00:00+07:00`).getTime()+86400000).toISOString().slice(0,19).replace('T',' '));}
    const limit=50,offset=(page-1)*limit;
    const [rows]=await this.db.pool.execute<any[]>(`SELECT a.*,u.fullName actorName FROM audit_logs a LEFT JOIN users u ON u.id=a.actorId ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY a.createdAt DESC,a.id DESC LIMIT ? OFFSET ?`,[...args,limit,offset]);
    return {data:rows,page,limit};
  }
  async resolveEvent(id:number,body:any,userId:number){
    const c=await this.db.pool.getConnection();try{await c.beginTransaction();const [rows]=await c.execute<any[]>('SELECT * FROM payment_events WHERE id=? FOR UPDATE',[this.int(id,'Payment event')]);const event=rows[0];if(!event)throw new NotFoundException('Không tìm thấy giao dịch treo.');if(event.status!=='NEEDS_REVIEW')throw new ConflictException('Giao dịch này không ở trạng thái cần đối soát.');
      if(body.action==='DISMISS'){await c.execute("UPDATE payment_events SET status='REJECTED' WHERE id=?",[id]);await c.execute("INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'PAYMENT_EVENT_DISMISSED','PAYMENT_EVENT',?,JSON_OBJECT('note',?))",[userId,String(id),String(body.note||'')]);await c.commit();return {data:{id,status:'REJECTED'}};}
      if(body.action!=='MATCH')throw new BadRequestException('Hành động đối soát không hợp lệ.');const bookingId=this.int(body.bookingId,'Booking');const payload=typeof event.payload==='string'?JSON.parse(event.payload):event.payload;const amount=this.int(payload.amount,'Số tiền');
      const [bookings]=await c.execute<any[]>("SELECT * FROM bookings WHERE id=? FOR UPDATE",[bookingId]);const booking=bookings[0];if(!booking||booking.status!=='PENDING_DEPOSIT'||amount<Number(booking.depositDue))throw new ConflictException('Booking không chờ cọc hoặc số tiền nhận được chưa đủ.');
      const ref=String(payload.transactionId||`RECON-${event.eventId}`);if(ref.length>120)throw new BadRequestException('Mã giao dịch quá dài.');const [payment]=await c.execute<any>(`INSERT INTO payments(bookingId,purpose,method,provider,providerReference,amount,status,paidAt) VALUES (?,'DEPOSIT','BANK_QR','DEMO_RECONCILE',?,?,'SUCCEEDED',UTC_TIMESTAMP())`,[bookingId,ref,amount]);
      await c.execute("UPDATE bookings SET status='DEPOSIT_PAID',expiresAt=NULL WHERE id=?",[bookingId]);await c.execute("UPDATE slot_occupancy SET state='CONFIRMED',expiresAt=NULL WHERE bookingId=?",[bookingId]);await c.execute("UPDATE service_orders SET status='CONFIRMED' WHERE bookingId=? AND status='DRAFT'",[bookingId]);await c.execute("UPDATE payment_events SET status='PROCESSED',paymentId=? WHERE id=?",[payment.insertId,id]);await c.execute("INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,'PAYMENT_EVENT_MATCHED','PAYMENT_EVENT',?,JSON_OBJECT('bookingId',?,'amount',?))",[userId,String(id),bookingId,amount]);await c.commit();return {data:{id,status:'PROCESSED',bookingId,paymentId:Number(payment.insertId)}};
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  }
  async events(status?:string){const [r]=await this.db.pool.execute<any[]>(`SELECT * FROM payment_events ${status?'WHERE status=?':''} ORDER BY receivedAt DESC LIMIT 200`,status?[status]:[]);return {data:r};}
}
