USE football_management;
DELIMITER $$
-- All mutations of slots/prices must take the pitch row lock first.
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
CREATE PROCEDURE sp_hold_slot(IN p_pitch INT,IN p_slot INT,IN p_date DATE,IN p_customer INT,IN p_code VARCHAR(50))
BEGIN
 DECLARE v_pitch INT DEFAULT NULL; DECLARE v_active VARCHAR(20); DECLARE v_start CHAR(5); DECLARE v_end CHAR(5);
 DECLARE v_old INT DEFAULT NULL; DECLARE v_state VARCHAR(20); DECLARE v_expiry DATETIME;
 DECLARE v_day VARCHAR(15); DECLARE v_count INT; DECLARE v_amount INT; DECLARE v_percent INT; DECLARE v_booking INT;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 SELECT id,status INTO v_pitch,v_active FROM pitches WHERE id=p_pitch FOR UPDATE;
 IF v_pitch IS NULL OR v_active<>'ACTIVE' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pitch unavailable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_customer AND status='ACTIVE') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Active customer required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM slots WHERE id=p_slot AND pitchId=p_pitch) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Slot does not belong to pitch'; END IF;
 SELECT `start`,`end` INTO v_start,v_end FROM slots WHERE id=p_slot;
 IF p_date IS NULL OR TIMESTAMP(p_date,CONCAT(v_start,':00'))<=UTC_TIMESTAMP()+INTERVAL 7 HOUR THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Slot is in the past'; END IF;
 IF EXISTS(SELECT 1 FROM pitch_blocks WHERE pitchId=p_pitch AND startsAt<TIMESTAMP(p_date,CONCAT(v_end,':00')) AND endsAt>TIMESTAMP(p_date,CONCAT(v_start,':00'))) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pitch blocked for maintenance'; END IF;
 SET v_day=CASE WHEN EXISTS(SELECT 1 FROM holidays WHERE date=p_date) THEN 'HOLIDAY' WHEN DAYOFWEEK(p_date) IN (1,7) THEN 'WEEKEND' ELSE 'WEEKDAY' END;
 SELECT COUNT(*),MAX(amount),MAX(depositPercent) INTO v_count,v_amount,v_percent FROM prices WHERE pitchId=p_pitch AND dayType=v_day AND `start`<=v_start AND `end`>=v_end;
 IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Missing or ambiguous price rule'; END IF;
 INSERT INTO slot_occupancy(pitchId,slotId,date,state,expiresAt) VALUES(p_pitch,p_slot,p_date,'HELD',UTC_TIMESTAMP()+INTERVAL 15 MINUTE)
 ON DUPLICATE KEY UPDATE pitchId=p_pitch;
 SELECT bookingId,state,expiresAt INTO v_old,v_state,v_expiry FROM slot_occupancy WHERE pitchId=p_pitch AND slotId=p_slot AND date=p_date FOR UPDATE;
 IF v_old IS NOT NULL AND (v_state='CONFIRMED' OR v_expiry>UTC_TIMESTAMP()) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Slot already occupied'; END IF;
 IF v_old IS NOT NULL THEN UPDATE bookings SET status='EXPIRED' WHERE id=v_old AND status='PENDING_DEPOSIT'; END IF;
 INSERT INTO bookings(code,pitchId,slotId,date,customerId,status,pitchAmount,depositDue,expiresAt)
 VALUES(p_code,p_pitch,p_slot,p_date,p_customer,'PENDING_DEPOSIT',v_amount,CEIL(v_amount*v_percent/100),UTC_TIMESTAMP()+INTERVAL 15 MINUTE);
 SET v_booking=LAST_INSERT_ID();
 UPDATE slot_occupancy SET bookingId=v_booking,state='HELD',expiresAt=UTC_TIMESTAMP()+INTERVAL 15 MINUTE WHERE pitchId=p_pitch AND slotId=p_slot AND date=p_date;
 COMMIT;
 SELECT v_booking AS bookingId;
END$$
-- Call only AFTER verifying bank signature and persisting the raw payment event.
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
  UPDATE slot_occupancy SET state='CONFIRMED',expiresAt=NULL WHERE bookingId=p_booking;
  COMMIT;
 END IF;
END$$
CREATE PROCEDURE sp_cancel_booking(IN p_booking INT)
BEGIN
 DECLARE v_pitch INT; DECLARE v_lock INT;
 DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
 START TRANSACTION;
 IF NOT EXISTS(SELECT 1 FROM bookings WHERE id=p_booking) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking not found'; END IF;
 SELECT pitchId INTO v_pitch FROM bookings WHERE id=p_booking;
 SELECT id INTO v_lock FROM pitches WHERE id=v_pitch FOR UPDATE;
 IF EXISTS(SELECT 1 FROM bookings WHERE id=p_booking AND status IN ('COMPLETED','CHECKED_IN')) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Booking cannot be cancelled in current state'; END IF;
 UPDATE bookings SET status='CANCELLED' WHERE id=p_booking;
 DELETE FROM slot_occupancy WHERE bookingId=p_booking;
 COMMIT;
 -- Refund approval and payment are separate financial actions.
END$$
DELIMITER ;
