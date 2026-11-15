-- Run only on an existing database created before this demo extension.
-- For a fresh database, database/01_schema.sql already contains these columns.
ALTER TABLE bookings ADD COLUMN serviceAmount INT NOT NULL DEFAULT 0 AFTER pitchAmount;
SET @old_deposit_check = (
  SELECT tc.CONSTRAINT_NAME
  FROM information_schema.TABLE_CONSTRAINTS tc
  JOIN information_schema.CHECK_CONSTRAINTS cc
    ON cc.CONSTRAINT_SCHEMA=tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME=tc.CONSTRAINT_NAME
  WHERE tc.CONSTRAINT_SCHEMA=DATABASE() AND tc.TABLE_NAME='bookings'
    AND tc.CONSTRAINT_TYPE='CHECK' AND cc.CHECK_CLAUSE LIKE '%depositDue%'
  LIMIT 1
);
SET @drop_sql = IF(@old_deposit_check IS NULL, 'SELECT 1', CONCAT('ALTER TABLE bookings DROP CHECK `', @old_deposit_check, '`'));
PREPARE drop_check_stmt FROM @drop_sql;
EXECUTE drop_check_stmt;
DEALLOCATE PREPARE drop_check_stmt;
ALTER TABLE bookings ADD CONSTRAINT chk_bookings_deposit_due CHECK (depositDue>0 AND depositDue<=pitchAmount+serviceAmount);
ALTER TABLE service_orders
  ADD COLUMN isDelivered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN isRestocked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE refunds
  ADD COLUMN bankName VARCHAR(100) NULL,
  ADD COLUMN accountNumber VARCHAR(50) NULL,
  ADD COLUMN accountName VARCHAR(150) NULL,
  ADD COLUMN rejectReason VARCHAR(255) NULL,
  ADD COLUMN proofUrl VARCHAR(1000) NULL;

-- Enable the Audit Log screen for MANAGER on an existing seeded database.
INSERT INTO permissions(code,description) VALUES('AUDIT_READ','Xem nhật ký')
  ON DUPLICATE KEY UPDATE description=VALUES(description);
INSERT INTO role_permissions(roleId,permissionId)
  SELECT 2,id FROM permissions WHERE code='AUDIT_READ'
  ON DUPLICATE KEY UPDATE permissionId=VALUES(permissionId);
