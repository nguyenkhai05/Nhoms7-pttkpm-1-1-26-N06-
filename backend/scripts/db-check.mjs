import 'dotenv/config';import {createPool} from 'mysql2/promise';import assert from 'node:assert/strict';
if(process.env.DB_ALLOW_TESTS!=='true')throw new Error('Use a demo database and set DB_ALLOW_TESTS=true before running db-check.');
const pool=createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'football_app',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'football_management',connectionLimit:4});
const prefix='TEST-'+Date.now(),date='2099-01-05';let bookingId;
try {
 const [[tables]]=await pool.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema=DATABASE() AND table_type='BASE TABLE'");assert.equal(Number(tables.n),29);console.log('PASS 29 tables');
 const results=await Promise.allSettled([pool.query('CALL sp_hold_slot(1,1,?,2,?)',[date,prefix+'A']),pool.query('CALL sp_hold_slot(1,1,?,2,?)',[date,prefix+'B'])]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);console.log('PASS concurrent hold: one winner');
 const [[b]]=await pool.query('SELECT id,depositDue FROM bookings WHERE code IN (?,?)',[prefix+'A',prefix+'B']);bookingId=b.id;
 await assert.rejects(()=>pool.query('CALL sp_confirm_deposit(?,?,?,?)',[bookingId,'TEST',prefix,1]));
 await pool.query('CALL sp_confirm_deposit(?,?,?,?)',[bookingId,'TEST',prefix,b.depositDue]);await pool.query('CALL sp_confirm_deposit(?,?,?,?)',[bookingId,'TEST',prefix,b.depositDue]);
 const [[payment]]=await pool.query("SELECT COUNT(*) AS n FROM payments WHERE provider='TEST' AND providerReference=?",[prefix]);assert.equal(Number(payment.n),1);console.log('PASS exact deposit and idempotency');
 await assert.rejects(()=>pool.query("INSERT INTO bookings(code,pitchId,slotId,date,status,pitchAmount,depositDue) VALUES(?,2,1,?,'PENDING_DEPOSIT',200000,60000)",[prefix+'FK',date]));console.log('PASS composite slot/pitch foreign key');
 const c=await pool.getConnection();try{await c.beginTransaction();await assert.rejects(()=>c.query('UPDATE inventory SET quantity=-1 WHERE complexId=1 AND serviceId=1'));await c.rollback();}finally{c.release();}console.log('PASS nonnegative stock');
 await pool.query('CALL sp_cancel_booking(?)',[bookingId]);const [[occ]]=await pool.query('SELECT COUNT(*) AS n FROM slot_occupancy WHERE bookingId=?',[bookingId]);assert.equal(Number(occ.n),0);console.log('PASS cancellation releases occupancy');
}finally {
 if(bookingId){await pool.query('DELETE FROM slot_occupancy WHERE bookingId=?',[bookingId]);await pool.query("DELETE FROM payments WHERE bookingId=? AND provider='TEST'",[bookingId]);await pool.query('DELETE FROM bookings WHERE id=? AND code LIKE ?',[bookingId,prefix+'%']);}
 await pool.end();
}
