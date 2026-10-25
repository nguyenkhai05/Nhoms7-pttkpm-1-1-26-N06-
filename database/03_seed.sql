USE football_management;
SET NAMES utf8mb4;
SET time_zone = '+00:00';
-- Run once after schema. This script contains NO DROP/TRUNCATE.
INSERT INTO roles(id,code,name) VALUES(1,'ADMIN','Quản trị viên'),(2,'MANAGER','Quản lý'),(3,'RECEPTIONIST','Lễ tân'),(4,'CUSTOMER','Khách hàng'),(5,'ACCOUNTANT','Kế toán');
INSERT INTO permissions(code,description) VALUES('PITCH_READ','Tra cứu sân'),('PITCH_WRITE','Quản lý sân và giá'),('BOOKING_WRITE','Vận hành đặt sân'),('PAYMENT_WRITE','Thu tiền và đối soát'),('REPORT_READ','Xem báo cáo'),('USER_WRITE','Quản lý tài khoản'),('STOCK_WRITE','Quản lý kho'),('REFUND_APPROVE','Duyệt hoàn cọc'),('AUDIT_READ','Xem nhật ký');
INSERT INTO role_permissions SELECT 1,id FROM permissions;
INSERT INTO role_permissions SELECT 2,id FROM permissions WHERE code IN ('PITCH_READ','PITCH_WRITE','BOOKING_WRITE','PAYMENT_WRITE','REPORT_READ','STOCK_WRITE','REFUND_APPROVE');
INSERT INTO role_permissions SELECT 3,id FROM permissions WHERE code IN ('PITCH_READ','BOOKING_WRITE','PAYMENT_WRITE','STOCK_WRITE');
INSERT INTO role_permissions SELECT 4,id FROM permissions WHERE code='PITCH_READ';
INSERT INTO role_permissions SELECT 5,id FROM permissions WHERE code IN ('PAYMENT_WRITE','REPORT_READ','REFUND_APPROVE');
-- Locked fixture accounts: NOT usable for login. Registration must generate a real Argon2/bcrypt hash.
INSERT INTO users(id,fullName,email,passwordHash,status) VALUES(1,'Quản trị mẫu','admin@example.test','DISABLED_FIXTURE','LOCKED'),(2,'Khách hàng mẫu','customer@example.test','DISABLED_FIXTURE','ACTIVE');
INSERT INTO user_roles VALUES(1,1),(2,4);
INSERT INTO complexes(id,name,address,district,contact,image) VALUES(1,'Cụm sân Phenikaa','Yên Nghĩa, Hà Nội','Hà Đông','0900000000','');
INSERT INTO pitches(id,complexId,name,type,grass,lights,status,image) VALUES(1,1,'Sân 7A',7,'Cỏ nhân tạo','Đèn LED','ACTIVE',''),(2,1,'Sân 5A',5,'Cỏ nhân tạo','Đèn LED','ACTIVE',''),(3,1,'Sân 11A',11,'Cỏ nhân tạo','Đèn LED','MAINTENANCE','');
INSERT INTO amenities(id,name) VALUES(1,'Bãi xe'),(2,'Phòng thay đồ'),(3,'Vòi tắm'),(4,'Đèn chiếu sáng');
INSERT INTO pitch_amenities VALUES(1,1),(1,2),(1,3),(1,4),(2,1),(2,4);
INSERT INTO prices(pitchId,dayType,`start`,`end`,amount,depositPercent)
 SELECT p.id,d.dayType,t.`start`,t.`end`,t.amount+IF(d.dayType='WEEKDAY',0,50000),30 FROM pitches p
 CROSS JOIN (SELECT 'WEEKDAY' AS dayType UNION ALL SELECT 'WEEKEND' UNION ALL SELECT 'HOLIDAY') d
 CROSS JOIN (SELECT '06:00' AS `start`,'17:00' AS `end`,200000 AS amount UNION ALL SELECT '17:00','22:00',350000) t;
-- Canonical slots; do not add overlapping slots using direct SQL.
INSERT INTO slots(id,pitchId,`start`,`end`) VALUES(1,1,'06:00','07:30'),(2,1,'07:30','09:00'),(3,1,'17:00','18:30'),(4,1,'18:30','20:00'),(5,1,'20:00','21:30'),(6,2,'06:00','07:30'),(7,2,'17:00','18:30'),(8,3,'17:00','18:30');
INSERT INTO services(id,name,kind,unit,price) VALUES(1,'Nước khoáng','SALE','chai',10000),(2,'Bóng thi đấu','RENTAL','quả/ca',30000),(3,'Áo bib','RENTAL','bộ/ca',50000);
INSERT INTO inventory VALUES(1,1,100,0,10),(1,2,10,0,2),(1,3,20,0,3);
INSERT INTO stock_movements(complexId,serviceId,delta,kind,unitCost,note) VALUES(1,1,100,'RECEIPT',5000,'Tồn đầu kỳ'),(1,2,10,'RECEIPT',200000,'Tồn đầu kỳ'),(1,3,20,'RECEIPT',100000,'Tồn đầu kỳ');
SET @demoDate=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR)+INTERVAL 1 DAY;
CALL sp_hold_slot(1,3,@demoDate,2,'DEMO-PAID');
SET @paidBooking=(SELECT id FROM bookings WHERE code='DEMO-PAID');
SET @deposit=(SELECT depositDue FROM bookings WHERE id=@paidBooking);
CALL sp_confirm_deposit(@paidBooking,'DEMO','DEMO-DEPOSIT-001',@deposit);
CALL sp_hold_slot(1,4,@demoDate,2,'DEMO-HELD');
SELECT @demoDate AS demoDate,'Xem ngày này để thấy ca đỏ và vàng (vàng hết hạn sau 15 phút)' AS note;
