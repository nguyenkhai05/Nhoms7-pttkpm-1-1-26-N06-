import 'dotenv/config';
import { createPool } from 'mysql2/promise';
import assert from 'node:assert/strict';

if (process.env.DB_ALLOW_TESTS !== 'true') {
  throw new Error('Use a demo database and set DB_ALLOW_TESTS=true before running db-check.');
}

const pool = createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'football_app',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'football_management',
  connectionLimit: 4,
});

const prefix = `TEST-${Date.now()}`;
const date = '2099-01-05';
let paidBookingId;
let pendingBookingId;
let expiredBookingId;

try {
  const [[tables]] = await pool.query(
    "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'",
  );
  assert.equal(Number(tables.n), 29);
  console.log('PASS 29 tables');

  const results = await Promise.allSettled([
    pool.query('CALL sp_hold_slot(1,1,?,2,?,JSON_ARRAY())', [date, `${prefix}-A`]),
    pool.query('CALL sp_hold_slot(1,1,?,2,?,JSON_ARRAY())', [date, `${prefix}-B`]),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  console.log('PASS concurrent hold: one winner');

  const [[paid]] = await pool.query(
    'SELECT id,depositDue FROM bookings WHERE code IN (?,?)',
    [`${prefix}-A`, `${prefix}-B`],
  );
  paidBookingId = paid.id;
  await assert.rejects(() =>
    pool.query('CALL sp_confirm_deposit(?,?,?,?)', [paidBookingId, 'TEST', `${prefix}-PAY`, 1]),
  );
  await pool.query('CALL sp_confirm_deposit(?,?,?,?)', [
    paidBookingId,
    'TEST',
    `${prefix}-PAY`,
    paid.depositDue,
  ]);
  await pool.query('CALL sp_confirm_deposit(?,?,?,?)', [
    paidBookingId,
    'TEST',
    `${prefix}-PAY`,
    paid.depositDue,
  ]);
  const [[payment]] = await pool.query(
    "SELECT COUNT(*) AS n FROM payments WHERE provider='TEST' AND providerReference=?",
    [`${prefix}-PAY`],
  );
  assert.equal(Number(payment.n), 1);
  console.log('PASS exact deposit and idempotency');

  await assert.rejects(() =>
    pool.query(
      "INSERT INTO bookings(code,pitchId,slotId,date,status,pitchAmount,depositDue) VALUES(?,2,1,?,'PENDING_DEPOSIT',200000,60000)",
      [`${prefix}-FK`, date],
    ),
  );
  console.log('PASS composite slot/pitch foreign key');

  const [[stockBefore]] = await pool.query(
    'SELECT quantity,reserved FROM inventory WHERE complexId=1 AND serviceId=1',
  );
  await pool.query('CALL sp_hold_slot(1,2,?,2,?,?)', [
    date,
    `${prefix}-SERVICE`,
    JSON.stringify([{ serviceId: 1, quantity: 2 }]),
  ]);
  const [[serviceBooking]] = await pool.query(
    'SELECT id FROM bookings WHERE code=?',
    [`${prefix}-SERVICE`],
  );
  pendingBookingId = serviceBooking.id;
  const [[stockHeld]] = await pool.query(
    'SELECT quantity,reserved FROM inventory WHERE complexId=1 AND serviceId=1',
  );
  assert.equal(Number(stockHeld.reserved), Number(stockBefore.reserved) + 2);
  await pool.query('CALL sp_cancel_pending_hold(?,?)', [pendingBookingId, 2]);
  const [[stockReleased]] = await pool.query(
    'SELECT quantity,reserved FROM inventory WHERE complexId=1 AND serviceId=1',
  );
  assert.equal(Number(stockReleased.reserved), Number(stockBefore.reserved));
  const [[cancelledOccupancy]] = await pool.query(
    'SELECT COUNT(*) AS n FROM slot_occupancy WHERE bookingId=?',
    [pendingBookingId],
  );
  assert.equal(Number(cancelledOccupancy.n), 0);
  console.log('PASS service stock reservation, release and occupancy cleanup');

  await pool.query('CALL sp_hold_slot(1,2,?,2,?,?)', [
    date,
    `${prefix}-EXPIRE`,
    JSON.stringify([{ serviceId: 1, quantity: 1 }]),
  ]);
  const [[expiring]] = await pool.query(
    'SELECT id FROM bookings WHERE code=?',
    [`${prefix}-EXPIRE`],
  );
  expiredBookingId = expiring.id;
  await pool.query(
    'UPDATE bookings SET expiresAt=UTC_TIMESTAMP()-INTERVAL 1 SECOND WHERE id=?',
    [expiredBookingId],
  );
  await pool.query('CALL sp_expire_pending_bookings()');
  const [[expired]] = await pool.query(
    'SELECT status FROM bookings WHERE id=?',
    [expiredBookingId],
  );
  assert.equal(expired.status, 'EXPIRED');
  const [[expiredOccupancy]] = await pool.query(
    'SELECT COUNT(*) AS n FROM slot_occupancy WHERE bookingId=?',
    [expiredBookingId],
  );
  assert.equal(Number(expiredOccupancy.n), 0);
  const [[stockAfterExpiry]] = await pool.query(
    'SELECT reserved FROM inventory WHERE complexId=1 AND serviceId=1',
  );
  assert.equal(Number(stockAfterExpiry.reserved), Number(stockBefore.reserved));
  console.log('PASS expiration worker releases slot and reserved stock');

  await assert.rejects(() =>
    pool.query('CALL sp_cancel_booking(?)', [paidBookingId]),
  );
  const [[paidOccupancy]] = await pool.query(
    'SELECT COUNT(*) AS n FROM slot_occupancy WHERE bookingId=?',
    [paidBookingId],
  );
  assert.equal(Number(paidOccupancy.n), 1);
  console.log('PASS paid booking cannot release slot before refund workflow');

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await assert.rejects(() =>
      connection.query('UPDATE inventory SET quantity=-1 WHERE complexId=1 AND serviceId=1'),
    );
    await connection.rollback();
  } finally {
    connection.release();
  }
  console.log('PASS nonnegative stock');
} finally {
  if (pendingBookingId) {
    await pool.query('DELETE FROM slot_occupancy WHERE bookingId=?', [pendingBookingId]);
    await pool.query(
      'DELETE FROM service_order_items WHERE orderId IN (SELECT id FROM service_orders WHERE bookingId=?)',
      [pendingBookingId],
    );
    await pool.query('DELETE FROM service_orders WHERE bookingId=?', [pendingBookingId]);
    await pool.query('DELETE FROM bookings WHERE id=?', [pendingBookingId]);
  }
  if (expiredBookingId) {
    await pool.query('DELETE FROM slot_occupancy WHERE bookingId=?', [expiredBookingId]);
    await pool.query(
      'DELETE FROM service_order_items WHERE orderId IN (SELECT id FROM service_orders WHERE bookingId=?)',
      [expiredBookingId],
    );
    await pool.query('DELETE FROM service_orders WHERE bookingId=?', [expiredBookingId]);
    await pool.query('DELETE FROM bookings WHERE id=?', [expiredBookingId]);
  }
  if (paidBookingId) {
    await pool.query('DELETE FROM slot_occupancy WHERE bookingId=?', [paidBookingId]);
    await pool.query("DELETE FROM payments WHERE bookingId=? AND provider='TEST'", [paidBookingId]);
    await pool.query('DELETE FROM bookings WHERE id=? AND code LIKE ?', [paidBookingId, `${prefix}%`]);
  }
  await pool.end();
}
