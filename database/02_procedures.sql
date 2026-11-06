USE football_management;
DELIMITER $$
-- All mutations of slots/prices must take the pitch row lock first.
DROP PROCEDURE IF EXISTS sp_add_slot$$
CREATE PROCEDURE sp_add_slot(IN p_pitch INT,IN p_start CHAR(5),IN p_end CHAR(5))
BEGIN
 DECLARE v_pitch INT DEFAULT NULL;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT id INTO v_pitch FROM pitches WHERE id=p_pitch FOR UPDATE;
 IF v_pitch IS NULL OR p_start>=p_end THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid pitch or time'; END IF;
 IF EXISTS(SELECT 1 FROM slots WHERE pitchId=p_pitch AND `start`<p_end AND `end`>p_start) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Overlapping slots'; END IF;
 INSERT INTO slots(pitchId,`start`,`end`) VALUES(p_pitch,p_start,p_end);
 COMMIT;
END$$
DROP PROCEDURE IF EXISTS sp_hold_slot$$
CREATE PROCEDURE sp_hold_slot(
 IN p_pitch INT, IN p_slot INT, IN p_date DATE, IN p_customer INT,
 IN p_code VARCHAR(50), IN p_services JSON
)
BEGIN
 DECLARE v_pitch INT DEFAULT NULL;
 DECLARE v_complex INT;
 DECLARE v_active VARCHAR(20);
 DECLARE v_start CHAR(5);
 DECLARE v_end CHAR(5);
 DECLARE v_old INT DEFAULT NULL;
 DECLARE v_state VARCHAR(20);
 DECLARE v_expiry DATETIME;
 DECLARE v_day VARCHAR(15);
 DECLARE v_count INT;
 DECLARE v_amount INT;
 DECLARE v_percent INT;
 DECLARE v_booking INT;
 DECLARE v_order INT;
 DECLARE v_expired INT DEFAULT 0;
 DECLARE v_service INT;
 DECLARE v_qty INT;
 DECLARE v_price INT;
 DECLARE v_service_total INT DEFAULT 0;
 DECLARE v_service_count INT DEFAULT 0;
 DECLARE v_distinct_count INT DEFAULT 0;
 DECLARE v_invalid_count INT DEFAULT 0;
 DECLARE v_done BOOLEAN DEFAULT FALSE;
 DECLARE service_cursor CURSOR FOR
  SELECT serviceId, quantity
  FROM JSON_TABLE(
   p_services, '$[*]' COLUMNS(
    serviceId INT PATH '$.serviceId' NULL ON EMPTY NULL ON ERROR,
    quantity INT PATH '$.quantity' NULL ON EMPTY NULL ON ERROR
   )
  ) AS requested
  ORDER BY serviceId;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

 START TRANSACTION;

 IF p_services IS NULL OR JSON_TYPE(p_services) <> 'ARRAY' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid services list';
 END IF;
 SELECT COUNT(*), COUNT(DISTINCT serviceId),
        SUM(serviceId IS NULL OR serviceId<=0 OR quantity IS NULL OR quantity<=0)
 INTO v_service_count,v_distinct_count,v_invalid_count
 FROM JSON_TABLE(
  p_services, '$[*]' COLUMNS(
   serviceId INT PATH '$.serviceId' NULL ON EMPTY NULL ON ERROR,
   quantity INT PATH '$.quantity' NULL ON EMPTY NULL ON ERROR
  )
 ) AS requested;
 IF v_invalid_count>0 OR v_service_count<>v_distinct_count THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Invalid or duplicated service selection';
 END IF;

 SELECT id,complexId,status INTO v_pitch,v_complex,v_active
 FROM pitches WHERE id=p_pitch FOR UPDATE;
 IF v_pitch IS NULL OR v_active<>'ACTIVE' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pitch unavailable';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_customer AND status='ACTIVE') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Active customer required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM slots WHERE id=p_slot AND pitchId=p_pitch) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Slot does not belong to pitch';
 END IF;
 SELECT `start`,`end` INTO v_start,v_end FROM slots WHERE id=p_slot;
 IF p_date IS NULL OR TIMESTAMP(p_date,CONCAT(v_start,':00'))<=UTC_TIMESTAMP()+INTERVAL 7 HOUR THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Slot is in the past';
 END IF;
 IF EXISTS(
  SELECT 1 FROM pitch_blocks
  WHERE pitchId=p_pitch
   AND startsAt<TIMESTAMP(p_date,CONCAT(v_end,':00'))
   AND endsAt>TIMESTAMP(p_date,CONCAT(v_start,':00'))
 ) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pitch blocked for maintenance';
 END IF;

 SET v_day=CASE
  WHEN EXISTS(SELECT 1 FROM holidays WHERE date=p_date) THEN 'HOLIDAY'
  WHEN DAYOFWEEK(p_date) IN (1,7) THEN 'WEEKEND'
  ELSE 'WEEKDAY' END;
 SELECT COUNT(*),MAX(amount),MAX(depositPercent)
 INTO v_count,v_amount,v_percent
 FROM prices
 WHERE pitchId=p_pitch AND dayType=v_day AND `start`<=v_start AND `end`>=v_end;
 IF v_count<>1 THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing or ambiguous price rule';
 END IF;

 INSERT INTO slot_occupancy(pitchId,slotId,date,state,expiresAt)
 VALUES(p_pitch,p_slot,p_date,'HELD',UTC_TIMESTAMP()+INTERVAL 15 MINUTE)
 ON DUPLICATE KEY UPDATE pitchId=VALUES(pitchId);
 SELECT bookingId,state,expiresAt INTO v_old,v_state,v_expiry
 FROM slot_occupancy
 WHERE pitchId=p_pitch AND slotId=p_slot AND date=p_date FOR UPDATE;

 IF v_old IS NOT NULL AND (v_state='CONFIRMED' OR v_expiry>UTC_TIMESTAMP()) THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Slot already occupied';
 END IF;

 IF v_old IS NOT NULL THEN
  UPDATE bookings SET status='EXPIRED',expiresAt=NULL
  WHERE id=v_old AND status='PENDING_DEPOSIT';
  SET v_expired=ROW_COUNT();
  IF v_expired<>1 THEN
   SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Existing slot occupancy is inconsistent; manual review required';
  END IF;
  UPDATE inventory i
  JOIN (
   SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) AS qty
   FROM service_orders so
   JOIN service_order_items si ON si.orderId=so.id
   WHERE so.bookingId=v_old AND so.status='DRAFT'
   GROUP BY so.complexId,si.serviceId
  ) reserved ON reserved.complexId=i.complexId AND reserved.serviceId=i.serviceId
  SET i.reserved=GREATEST(0,i.reserved-reserved.qty);
  UPDATE service_orders SET status='CANCELLED'
  WHERE bookingId=v_old AND status='DRAFT';
 END IF;

 INSERT INTO bookings(code,pitchId,slotId,date,customerId,status,pitchAmount,depositDue,expiresAt)
 VALUES(p_code,p_pitch,p_slot,p_date,p_customer,'PENDING_DEPOSIT',v_amount,1,UTC_TIMESTAMP()+INTERVAL 15 MINUTE);
 SET v_booking=LAST_INSERT_ID();

 IF v_service_count>0 THEN
  INSERT INTO service_orders(bookingId,complexId,status)
  VALUES(v_booking,v_complex,'DRAFT');
  SET v_order=LAST_INSERT_ID();

  OPEN service_cursor;
  service_loop: LOOP
   FETCH service_cursor INTO v_service,v_qty;
   IF v_done THEN LEAVE service_loop; END IF;

   UPDATE inventory i
   JOIN services s ON s.id=v_service AND s.active=TRUE
   SET i.reserved=i.reserved+v_qty
   WHERE i.complexId=v_complex AND i.serviceId=v_service
    AND i.quantity-i.reserved>=v_qty;
   IF ROW_COUNT()<>1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Service stock is insufficient or unavailable';
   END IF;

   SELECT price INTO v_price FROM services WHERE id=v_service AND active=TRUE FOR UPDATE;
   SET v_service_total=v_service_total+(v_price*v_qty);
   INSERT INTO service_order_items(orderId,serviceId,quantity,unitPrice)
   VALUES(v_order,v_service,v_qty,v_price);
  END LOOP;
  CLOSE service_cursor;
 END IF;

 UPDATE bookings
 SET depositDue=CEIL((v_amount+v_service_total)*v_percent/100)
 WHERE id=v_booking;

 UPDATE slot_occupancy
 SET bookingId=v_booking,state='HELD',expiresAt=UTC_TIMESTAMP()+INTERVAL 15 MINUTE
 WHERE pitchId=p_pitch AND slotId=p_slot AND date=p_date;

 COMMIT;
 SELECT v_booking AS bookingId;
END$$
-- Call only AFTER verifying bank signature and persisting the raw payment event.
DROP PROCEDURE IF EXISTS sp_confirm_deposit$$
CREATE PROCEDURE sp_confirm_deposit(IN p_booking INT,IN p_provider VARCHAR(50),IN p_reference VARCHAR(120),IN p_amount INT)
BEGIN
 DECLARE v_payment INT DEFAULT NULL; DECLARE v_pitch INT; DECLARE v_lock INT; DECLARE v_status VARCHAR(30); DECLARE v_due INT; DECLARE v_expiry DATETIME;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=p_booking) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking not found'; END IF;
 SELECT pitchId INTO v_pitch FROM bookings WHERE id=p_booking;
 SELECT id INTO v_lock FROM pitches WHERE id=v_pitch FOR UPDATE;
 SELECT status,depositDue,expiresAt INTO v_status,v_due,v_expiry FROM bookings WHERE id=p_booking FOR UPDATE;
 SELECT id INTO v_payment FROM payments WHERE provider=p_provider AND providerReference=p_reference AND bookingId=p_booking AND amount=p_amount AND status='SUCCEEDED' LIMIT 1 FOR UPDATE;
 IF v_payment IS NOT NULL THEN
  COMMIT;
 ELSE
  IF v_status<>'PENDING_DEPOSIT' OR v_expiry<=UTC_TIMESTAMP() OR v_expiry IS NULL OR p_amount<>v_due THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Late payment, wrong amount or invalid state; manual reconciliation required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM slot_occupancy WHERE bookingId=p_booking AND state='HELD' AND expiresAt>UTC_TIMESTAMP()) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Hold no longer valid'; END IF;
  INSERT INTO payments(bookingId,purpose,method,provider,providerReference,amount,status,paidAt) VALUES(p_booking,'DEPOSIT','BANK_QR',p_provider,p_reference,p_amount,'SUCCEEDED',UTC_TIMESTAMP());
  UPDATE bookings SET status='DEPOSIT_PAID',expiresAt=NULL WHERE id=p_booking;
  UPDATE service_orders SET status='CONFIRMED' WHERE bookingId=p_booking AND status='DRAFT';
  UPDATE slot_occupancy SET state='CONFIRMED',expiresAt=NULL WHERE bookingId=p_booking;
  COMMIT;
 END IF;
END$$
DROP PROCEDURE IF EXISTS sp_cancel_booking$$
CREATE PROCEDURE sp_cancel_booking(IN p_booking INT)
BEGIN
 DECLARE v_pitch INT; DECLARE v_lock INT;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=p_booking) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking not found'; END IF;
 SELECT pitchId INTO v_pitch FROM bookings WHERE id=p_booking;
 SELECT id INTO v_lock FROM pitches WHERE id=v_pitch FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=p_booking AND status='PENDING_DEPOSIT') THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Paid bookings must use the refund workflow before releasing a slot';
 END IF;
 UPDATE inventory i
 JOIN (
  SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) AS qty
  FROM service_orders so
  JOIN service_order_items si ON si.orderId=so.id
  WHERE so.bookingId=p_booking AND so.status='DRAFT'
  GROUP BY so.complexId,si.serviceId
 ) reserved ON reserved.complexId=i.complexId AND reserved.serviceId=i.serviceId
 SET i.reserved=GREATEST(0,i.reserved-reserved.qty);
 UPDATE service_orders SET status='CANCELLED' WHERE bookingId=p_booking AND status='DRAFT';
 UPDATE bookings SET status='CANCELLED',expiresAt=NULL WHERE id=p_booking;
 DELETE FROM slot_occupancy WHERE bookingId=p_booking;
 COMMIT;
 -- Refund approval and payment are separate financial actions.
END$$

DROP PROCEDURE IF EXISTS sp_cancel_pending_hold$$
CREATE PROCEDURE sp_cancel_pending_hold(IN p_booking INT, IN p_customer INT)
BEGIN
 DECLARE v_pitch INT DEFAULT NULL;
 DECLARE v_lock INT;
 DECLARE v_status VARCHAR(30);
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT pitchId INTO v_pitch FROM bookings WHERE id=p_booking;
 IF v_pitch IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking not found'; END IF;
 SELECT id INTO v_lock FROM pitches WHERE id=v_pitch FOR UPDATE;
 SELECT status INTO v_status FROM bookings
 WHERE id=p_booking AND customerId=p_customer FOR UPDATE;
 IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking not found'; END IF;
 IF v_status<>'PENDING_DEPOSIT' THEN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Only a pending deposit hold can be cancelled here';
 END IF;
 UPDATE inventory i
 JOIN (
  SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) AS qty
  FROM service_orders so
  JOIN service_order_items si ON si.orderId=so.id
  WHERE so.bookingId=p_booking AND so.status='DRAFT'
  GROUP BY so.complexId,si.serviceId
 ) reserved ON reserved.complexId=i.complexId AND reserved.serviceId=i.serviceId
 SET i.reserved=GREATEST(0,i.reserved-reserved.qty);
 UPDATE service_orders SET status='CANCELLED' WHERE bookingId=p_booking AND status='DRAFT';
 UPDATE bookings SET status='CANCELLED',expiresAt=NULL WHERE id=p_booking;
 DELETE FROM slot_occupancy WHERE bookingId=p_booking;
 COMMIT;
END$$

DROP PROCEDURE IF EXISTS sp_expire_pending_booking$$
CREATE PROCEDURE sp_expire_pending_booking(IN p_booking INT)
BEGIN
 DECLARE v_pitch INT DEFAULT NULL;
 DECLARE v_status VARCHAR(30);
 DECLARE v_expiry DATETIME;
 DECLARE v_lock INT;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT pitchId INTO v_pitch FROM bookings WHERE id=p_booking;
 IF v_pitch IS NOT NULL THEN
  SELECT id INTO v_lock FROM pitches WHERE id=v_pitch FOR UPDATE;
  SELECT status,expiresAt INTO v_status,v_expiry FROM bookings WHERE id=p_booking FOR UPDATE;
  IF v_status='PENDING_DEPOSIT' AND v_expiry<=UTC_TIMESTAMP() THEN
   UPDATE inventory i
   JOIN (
    SELECT so.complexId,si.serviceId,SUM(si.quantity-si.returnedQuantity) AS qty
    FROM service_orders so
    JOIN service_order_items si ON si.orderId=so.id
    WHERE so.bookingId=p_booking AND so.status='DRAFT'
    GROUP BY so.complexId,si.serviceId
   ) reserved ON reserved.complexId=i.complexId AND reserved.serviceId=i.serviceId
   SET i.reserved=GREATEST(0,i.reserved-reserved.qty);
   UPDATE service_orders SET status='CANCELLED' WHERE bookingId=p_booking AND status='DRAFT';
   UPDATE bookings SET status='EXPIRED',expiresAt=NULL WHERE id=p_booking;
   DELETE FROM slot_occupancy WHERE bookingId=p_booking;
  END IF;
 END IF;
 COMMIT;
END$$

DROP PROCEDURE IF EXISTS sp_expire_pending_bookings$$
CREATE PROCEDURE sp_expire_pending_bookings()
BEGIN
 DECLARE v_done BOOLEAN DEFAULT FALSE;
 DECLARE v_booking INT;
 DECLARE expired_cursor CURSOR FOR
  SELECT id FROM bookings
  WHERE status='PENDING_DEPOSIT' AND expiresAt<=UTC_TIMESTAMP()
  ORDER BY expiresAt LIMIT 100;
 DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done=TRUE;
 OPEN expired_cursor;
 expire_loop: LOOP
  FETCH expired_cursor INTO v_booking;
  IF v_done THEN LEAVE expire_loop; END IF;
  CALL sp_expire_pending_booking(v_booking);
 END LOOP;
 CLOSE expired_cursor;
END$$

DELIMITER ;
