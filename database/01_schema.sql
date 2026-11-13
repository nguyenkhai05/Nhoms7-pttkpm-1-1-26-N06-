-- MySQL 8.0.16+ / InnoDB / UTF-8. Run on a NEW database.
CREATE DATABASE IF NOT EXISTS football_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE football_management;
SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE roles (
id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE permissions (
id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(80) NOT NULL UNIQUE, description VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
roleId INT NOT NULL, permissionId INT NOT NULL, PRIMARY KEY(roleId,permissionId), FOREIGN KEY(roleId) REFERENCES roles(id), FOREIGN KEY(permissionId) REFERENCES permissions(id)
) ENGINE=InnoDB;

CREATE TABLE users (
id INT PRIMARY KEY AUTO_INCREMENT, fullName VARCHAR(120) NOT NULL,
email VARCHAR(190) NOT NULL UNIQUE, phone VARCHAR(30), passwordHash VARCHAR(255) NOT NULL,
status ENUM('ACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE user_roles (
userId INT NOT NULL, roleId INT NOT NULL, PRIMARY KEY(userId,roleId), FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(roleId) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE refresh_tokens (
id BIGINT PRIMARY KEY AUTO_INCREMENT, userId INT NOT NULL, tokenHash CHAR(64) NOT NULL UNIQUE, expiresAt DATETIME NOT NULL, revokedAt DATETIME, FOREIGN KEY(userId) REFERENCES users(id), INDEX(userId,expiresAt)
) ENGINE=InnoDB;

CREATE TABLE complexes (
id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, address VARCHAR(255) NOT NULL, district VARCHAR(100) NOT NULL, contact VARCHAR(60), image VARCHAR(1000), description TEXT, INDEX(district)
) ENGINE=InnoDB;

CREATE TABLE pitches (
id INT PRIMARY KEY AUTO_INCREMENT, complexId INT NOT NULL, name VARCHAR(100) NOT NULL,
type INT NOT NULL CHECK(type IN (5,7,11)), grass VARCHAR(150), lights VARCHAR(150),
status ENUM('ACTIVE','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'ACTIVE', image VARCHAR(1000),
FOREIGN KEY(complexId) REFERENCES complexes(id), UNIQUE(complexId,name), INDEX(status,type,complexId)
) ENGINE=InnoDB;

CREATE TABLE pitch_images (
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL, url VARCHAR(1000) NOT NULL, caption VARCHAR(255), sortOrder INT NOT NULL DEFAULT 0, FOREIGN KEY(pitchId) REFERENCES pitches(id)
) ENGINE=InnoDB;

CREATE TABLE amenities (
id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE pitch_amenities (
pitchId INT NOT NULL, amenityId INT NOT NULL, PRIMARY KEY(pitchId,amenityId), FOREIGN KEY(pitchId) REFERENCES pitches(id), FOREIGN KEY(amenityId) REFERENCES amenities(id), INDEX(amenityId,pitchId)
) ENGINE=InnoDB;

CREATE TABLE holidays (
date DATE PRIMARY KEY, name VARCHAR(150) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE prices (
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL,
dayType ENUM('WEEKDAY','WEEKEND','HOLIDAY') NOT NULL, `start` CHAR(5) NOT NULL, `end` CHAR(5) NOT NULL,
amount INT NOT NULL CHECK(amount>0), depositPercent INT NOT NULL DEFAULT 30 CHECK(depositPercent BETWEEN 1 AND 100),
CHECK(`start`<`end`), CHECK(`start` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'), CHECK(`end` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
FOREIGN KEY(pitchId) REFERENCES pitches(id), UNIQUE(pitchId,dayType,`start`,`end`)
) ENGINE=InnoDB;

CREATE TABLE slots (
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL, `start` CHAR(5) NOT NULL, `end` CHAR(5) NOT NULL,
CHECK(`start`<`end`), CHECK(`start` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'), CHECK(`end` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
FOREIGN KEY(pitchId) REFERENCES pitches(id), UNIQUE(pitchId,`start`,`end`), UNIQUE(id,pitchId)
) ENGINE=InnoDB;

CREATE TABLE pitch_blocks (
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL, startsAt DATETIME NOT NULL, endsAt DATETIME NOT NULL, reason VARCHAR(255) NOT NULL, CHECK(startsAt<endsAt), FOREIGN KEY(pitchId) REFERENCES pitches(id), INDEX(pitchId,startsAt,endsAt)
) ENGINE=InnoDB;

CREATE TABLE bookings (
id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(50) NOT NULL UNIQUE,
pitchId INT NOT NULL, slotId INT NOT NULL, date DATE NOT NULL, customerId INT,
guestName VARCHAR(120), guestPhone VARCHAR(30), createdBy INT,
source ENUM('ONLINE','WALK_IN') NOT NULL DEFAULT 'ONLINE',
status ENUM('PENDING_DEPOSIT','DEPOSIT_PAID','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED') NOT NULL,
pitchAmount INT NOT NULL CHECK(pitchAmount>0), depositDue INT NOT NULL CHECK(depositDue>0 AND depositDue<=pitchAmount),
expiresAt DATETIME, checkedInAt DATETIME, completedAt DATETIME, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(slotId,pitchId) REFERENCES slots(id,pitchId), FOREIGN KEY(customerId) REFERENCES users(id), FOREIGN KEY(createdBy) REFERENCES users(id),
INDEX(pitchId,date,status), INDEX(customerId,createdAt), INDEX(status,expiresAt)
) ENGINE=InnoDB;

CREATE TABLE slot_occupancy (
pitchId INT NOT NULL, slotId INT NOT NULL, date DATE NOT NULL, bookingId INT UNIQUE,
state ENUM('HELD','CONFIRMED') NOT NULL, expiresAt DATETIME,
PRIMARY KEY(pitchId,slotId,date), FOREIGN KEY(slotId,pitchId) REFERENCES slots(id,pitchId), FOREIGN KEY(bookingId) REFERENCES bookings(id),
CHECK((state='HELD' AND expiresAt IS NOT NULL) OR (state='CONFIRMED' AND expiresAt IS NULL)), INDEX(state,expiresAt)
) ENGINE=InnoDB;

CREATE TABLE services (
id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, kind ENUM('SALE','RENTAL') NOT NULL,
unit VARCHAR(30) NOT NULL, price INT NOT NULL CHECK(price>=0), active BOOLEAN NOT NULL DEFAULT TRUE, image VARCHAR(1000)
) ENGINE=InnoDB;

CREATE TABLE inventory (
complexId INT NOT NULL, serviceId INT NOT NULL, quantity INT NOT NULL DEFAULT 0, reserved INT NOT NULL DEFAULT 0,
minQuantity INT NOT NULL DEFAULT 0, PRIMARY KEY(complexId,serviceId),
CHECK(quantity>=0 AND reserved>=0 AND reserved<=quantity AND minQuantity>=0), FOREIGN KEY(complexId) REFERENCES complexes(id), FOREIGN KEY(serviceId) REFERENCES services(id)
) ENGINE=InnoDB;

CREATE TABLE stock_movements (
id BIGINT PRIMARY KEY AUTO_INCREMENT, complexId INT NOT NULL, serviceId INT NOT NULL, delta INT NOT NULL CHECK(delta<>0),
kind ENUM('RECEIPT','SALE','LOSS','RENT_OUT','RENT_RETURN','ADJUSTMENT') NOT NULL, unitCost INT CHECK(unitCost>=0),
reference VARCHAR(100), note VARCHAR(255), createdBy INT, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(complexId,serviceId) REFERENCES inventory(complexId,serviceId), FOREIGN KEY(createdBy) REFERENCES users(id), INDEX(complexId,serviceId,createdAt)
) ENGINE=InnoDB;

CREATE TABLE service_orders (
id INT PRIMARY KEY AUTO_INCREMENT, bookingId INT, complexId INT NOT NULL, createdBy INT,
status ENUM('DRAFT','CONFIRMED','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT', createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(bookingId) REFERENCES bookings(id), FOREIGN KEY(complexId) REFERENCES complexes(id), FOREIGN KEY(createdBy) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE service_order_items (
id INT PRIMARY KEY AUTO_INCREMENT, orderId INT NOT NULL, serviceId INT NOT NULL,
quantity INT NOT NULL CHECK(quantity>0), unitPrice INT NOT NULL CHECK(unitPrice>=0),
returnedQuantity INT NOT NULL DEFAULT 0 CHECK(returnedQuantity>=0 AND returnedQuantity<=quantity),
FOREIGN KEY(orderId) REFERENCES service_orders(id), FOREIGN KEY(serviceId) REFERENCES services(id), UNIQUE(orderId,serviceId)
) ENGINE=InnoDB;

CREATE TABLE bank_accounts (
id INT PRIMARY KEY AUTO_INCREMENT, complexId INT NOT NULL, bankCode VARCHAR(30) NOT NULL, accountNumber VARCHAR(50) NOT NULL,
accountName VARCHAR(150) NOT NULL, provider VARCHAR(50) NOT NULL, secretEnvKey VARCHAR(100), active BOOLEAN NOT NULL DEFAULT TRUE,
FOREIGN KEY(complexId) REFERENCES complexes(id), UNIQUE(complexId,bankCode,accountNumber)
) ENGINE=InnoDB;

CREATE TABLE payments (
id INT PRIMARY KEY AUTO_INCREMENT, bookingId INT, serviceOrderId INT,
purpose ENUM('DEPOSIT','SETTLEMENT','SERVICE') NOT NULL, method ENUM('CASH','BANK_QR') NOT NULL,
provider VARCHAR(50) NOT NULL, providerReference VARCHAR(120) NOT NULL, amount INT NOT NULL CHECK(amount>0),
status ENUM('PENDING','SUCCEEDED','FAILED') NOT NULL, paidAt DATETIME, receivedBy INT, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CHECK((bookingId IS NOT NULL AND serviceOrderId IS NULL) OR (bookingId IS NULL AND serviceOrderId IS NOT NULL)),
CHECK((status='SUCCEEDED' AND paidAt IS NOT NULL) OR status<>'SUCCEEDED'),
FOREIGN KEY(bookingId) REFERENCES bookings(id), FOREIGN KEY(serviceOrderId) REFERENCES service_orders(id), FOREIGN KEY(receivedBy) REFERENCES users(id),
UNIQUE(provider,providerReference), INDEX(status,paidAt)
) ENGINE=InnoDB;

CREATE TABLE payment_events (
id BIGINT PRIMARY KEY AUTO_INCREMENT, provider VARCHAR(50) NOT NULL, eventId VARCHAR(120) NOT NULL,
paymentId INT, signatureValid BOOLEAN NOT NULL, payload JSON NOT NULL,
status ENUM('RECEIVED','PROCESSED','REJECTED','NEEDS_REVIEW') NOT NULL DEFAULT 'RECEIVED',
receivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(paymentId) REFERENCES payments(id), UNIQUE(provider,eventId)
) ENGINE=InnoDB;

CREATE TABLE refunds (
id INT PRIMARY KEY AUTO_INCREMENT, paymentId INT NOT NULL, amount INT NOT NULL CHECK(amount>0),
reason VARCHAR(255) NOT NULL, status ENUM('REQUESTED','APPROVED','PAID','REJECTED','FAILED') NOT NULL DEFAULT 'REQUESTED',
requestedBy INT, approvedBy INT, providerReference VARCHAR(120) UNIQUE, requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, paidAt DATETIME,
CHECK(status<>'PAID' OR paidAt IS NOT NULL), FOREIGN KEY(paymentId) REFERENCES payments(id), FOREIGN KEY(requestedBy) REFERENCES users(id), FOREIGN KEY(approvedBy) REFERENCES users(id), INDEX(status,paidAt)
) ENGINE=InnoDB;

CREATE TABLE reviews (
id INT PRIMARY KEY AUTO_INCREMENT, bookingId INT NOT NULL UNIQUE, userId INT NOT NULL,
rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5), content TEXT, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(bookingId) REFERENCES bookings(id), FOREIGN KEY(userId) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
id BIGINT PRIMARY KEY AUTO_INCREMENT, actorId INT, action VARCHAR(100) NOT NULL, entityType VARCHAR(80) NOT NULL,
entityId VARCHAR(80), beforeData JSON, afterData JSON, ip VARCHAR(45), createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(actorId) REFERENCES users(id), INDEX(entityType,entityId,createdAt), INDEX(actorId,createdAt)
) ENGINE=InnoDB;

CREATE TABLE notifications (
id BIGINT PRIMARY KEY AUTO_INCREMENT, userId INT NOT NULL, bookingId INT, title VARCHAR(150) NOT NULL,
content TEXT NOT NULL, readAt DATETIME, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(bookingId) REFERENCES bookings(id), INDEX(userId,readAt)
) ENGINE=InnoDB;

-- Gross successful collections and actual refunds are separate cash events.
CREATE VIEW v_cash_events AS
 SELECT paidAt AS occurredAt, amount AS signedAmount, 'PAYMENT' AS kind, id AS sourceId FROM payments WHERE status='SUCCEEDED'
 UNION ALL
 SELECT paidAt, -amount, 'REFUND', id FROM refunds WHERE status='PAID';
CREATE VIEW v_daily_cashflow AS
 SELECT DATE(occurredAt + INTERVAL 7 HOUR) AS localDate,
 SUM(CASE WHEN signedAmount>0 THEN signedAmount ELSE 0 END) AS grossCollected,
 -SUM(CASE WHEN signedAmount<0 THEN signedAmount ELSE 0 END) AS refunded,
 SUM(signedAmount) AS netCollected FROM v_cash_events GROUP BY DATE(occurredAt + INTERVAL 7 HOUR);
CREATE VIEW v_low_stock AS
 SELECT i.*,s.name,(i.quantity-i.reserved) AS available FROM inventory i JOIN services s ON s.id=i.serviceId WHERE i.quantity-i.reserved<=i.minQuantity;
