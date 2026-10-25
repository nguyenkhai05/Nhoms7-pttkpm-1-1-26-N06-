USE football_management;
-- Only SELECT examples. No modification of operational data.
SELECT id,code,name FROM roles;
SELECT p.id,p.name,p.type,c.district,MIN(r.amount) AS startingPrice
 FROM pitches p JOIN complexes c ON c.id=p.complexId JOIN prices r ON r.pitchId=p.id
 WHERE p.status='ACTIVE' GROUP BY p.id,p.name,p.type,c.district;
SELECT * FROM bookings ORDER BY createdAt DESC LIMIT 20;
SELECT o.*,b.code FROM slot_occupancy o LEFT JOIN bookings b ON b.id=o.bookingId
 WHERE o.state='CONFIRMED' OR o.expiresAt>UTC_TIMESTAMP();
SELECT * FROM v_daily_cashflow ORDER BY localDate DESC;
SELECT * FROM v_low_stock;
SELECT provider,eventId,status,signatureValid FROM payment_events ORDER BY receivedAt DESC LIMIT 20;
