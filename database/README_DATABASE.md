# Database hệ thống quản lý sân bóng

Bộ database dùng MySQL 8.0.16 trở lên (compose sử dụng MySQL 8.4), gồm 29 bảng, 3 view và 4 stored procedure. Backend UC1.2 đã chuyển sang mysql2 với truy vấn bất đồng bộ; frontend giữ API cũ. Database bao phủ dữ liệu cho các issue hiện có, không có nghĩa các API của toàn hệ thống đã được cài đặt.

## Ánh xạ database với issue

| Issue | Bảng dữ liệu | Phạm vi |
|---|---|---|
|Đăng ký và đăng nhập|users, roles, permissions, user_roles, role_permissions, refresh_tokens|Email duy nhất, hash mật khẩu, khóa tài khoản, vai trò và phiên đăng nhập.|
|Trang chủ|complexes, pitches, pitch_images, amenities, pitch_amenities, reviews|Dữ liệu hiển thị lấy từ các bảng nghiệp vụ; không cần bảng homepage riêng.|
|Tìm kiếm sân và xem lịch trống|complexes, pitches, prices, slots, holidays, pitch_blocks, bookings, slot_occupancy|UC1.2 đã nối API NestJS sang các bảng này.|
|Quản lý danh mục sân và cấu hình bảng giá|complexes, pitches, pitch_images, amenities, pitch_amenities, prices, holidays, slots, pitch_blocks|Các màn hình/API ghi cấu hình chưa được cài đặt.|
|Quản lý ma trận lịch sân và đặt tại chỗ|bookings, slot_occupancy, pitch_blocks, users|Có source WALK_IN, thông tin khách vãng lai, người tạo và thời điểm check-in.|
|Đặt sân và chọn dịch vụ|bookings, slot_occupancy, services, inventory, service_orders, service_order_items|Giá sân và giá dịch vụ được chụp lại khi tạo đơn; không dùng giá hiện tại để tính lại đơn cũ.|
|Thanh toán tiền cọc qua VietQR|bank_accounts, payments, payment_events, refunds|Mã giao dịch/sự kiện duy nhất; hỗ trợ đối soát và hoàn cọc. Không chứa Secret Key thật.|
|Báo cáo và Dashboard|payments, refunds, bookings, stock_movements; v_daily_cashflow, v_low_stock|View dòng tiền thuần tính tiền nhận trừ khoản đã hoàn, không cộng giá trị Booking chưa thanh toán.|
|Tạo database và vận hành|Tất cả 29 bảng; audit_logs, notifications|SQL, khóa chính/ngoại, chỉ mục, CHECK, dữ liệu mẫu và stored procedure.|

## Khởi tạo bằng Docker trong Codespaces

Mở terminal ở thư mục gốc dự án (nơi có compose.yaml):

```sh
cp .env.example .env
```

Sửa hai mật khẩu trong .env rồi chạy:

```sh
docker compose up -d
docker compose ps
docker compose logs mysql
```

Chờ health chuyển healthy. Docker tự chạy 01_schema.sql, 02_procedures.sql, 03_seed.sql theo thứ tự khi volume database còn trống. Nếu cổng 3306 đã dùng, chỉnh cổng bên trái trong compose.yaml và DB_PORT của backend cho khớp. Không cần public cổng MySQL trên Codespaces.

Tạo cấu hình backend:

```sh
cd backend
cp .env.example .env
npm ci
npm run build
npm run start:dev
```

DB_PASSWORD trong backend/.env phải giống DB_PASSWORD ở .env gốc; DB_USER=football_app; DB_NAME=football_management. Dotenv tự nạp backend/.env khi chạy trong backend. PORT=3000 để khớp proxy Vite. Backend không tự tạo database hay seed lại mỗi lần khởi động.

Terminal thứ hai:

```sh
cd frontend
npm ci
npm run dev
```

Mở URL frontend trên cổng 5173. Trang chi tiết có lịch ngày; dữ liệu mẫu có ca đỏ lúc 17:00 và ca vàng lúc 18:30 của NGÀY MAI theo giờ Việt Nam lúc seed. Ca vàng hết hạn sau 15 phút; khi cần dữ liệu mới, dùng thủ tục giữ ca để tạo thêm trên ngày tương lai. Không chạy lại seed trên database đang có dữ liệu.

`docker compose down` dừng container và giữ dữ liệu volume. Không dùng `docker compose down -v` trừ khi chủ động muốn xóa toàn bộ database demo.

## Nhập bằng MySQL Workbench

Nếu đã có MySQL 8: kết nối bằng tài khoản có quyền tạo database, bảng, view và routine. Mở và chạy toàn bộ lần lượt 01_schema.sql → 02_procedures.sql → 03_seed.sql. Chỉ dùng database mới tên football_management. Script không DROP/TRUNCATE dữ liệu; nếu bảng đã tồn tại sẽ dừng báo lỗi, không tự ghi đè.

Tạo tài khoản ứng dụng riêng, thay mật khẩu bên dưới trước khi thực thi. Chọn host phù hợp máy chạy backend; không dùng tài khoản root trong ứng dụng:

```sql
CREATE USER 'football_app'@'localhost' IDENTIFIED BY 'YOUR_LOCAL_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON football_management.* TO 'football_app'@'localhost';
```

Với Docker, image tự tạo football_app; không cần chạy CREATE USER lần nữa. Với MySQL cloud, dùng host/port/SSL theo nhà cung cấp; adapter hiện chưa cấu hình chứng chỉ SSL nên cần bổ sung cấu hình đó trước khi dùng kết nối cloud yêu cầu TLS.

## Quy tắc thời gian và tiền

- Tiền là số nguyên đồng Việt Nam (VND), giá sân tính trọn ca. Đơn giữ pitchAmount và depositDue; dòng dịch vụ giữ unitPrice để lịch sử không đổi khi sửa bảng giá.
- date của lịch và pitch_blocks là ngày/giờ địa phương Việt Nam. Timestamp thanh toán, khóa tạm, token và audit dùng UTC. Backend gọi UTC_TIMESTAMP cho TTL và cấu hình mysql2 timezone Z.
- Cuối tuần là thứ Bảy/Chủ nhật; holidays được ưu tiên hơn cuối tuần. Mỗi ca cần được bao bởi đúng một price rule của loại ngày đó; không có hoặc có nhiều rule thì không cho chọn.
- slot_occupancy là nguồn chính xác định xanh/vàng/đỏ: HELD chưa hết hạn là vàng, CONFIRMED là đỏ; không còn occupancy hiệu lực là xanh. Sân bảo trì hoặc pitch_blocks giao với ca cũng là đỏ.
- Khóa hết hạn vẫn có thể còn bản ghi vật lý, nhưng API bỏ qua. Lần giữ tiếp theo sẽ chuyển Booking cũ sang EXPIRED và dùng lại occupancy. Cron có thể dọn dữ liệu sau, phải dùng cùng thứ tự khóa như thủ tục để không đụng giao dịch đang xác nhận cọc.

## Stored procedure và xử lý đồng thời

| Routine | Nhiệm vụ |
|---|---|
| sp_add_slot(pitch, start, end) | Khóa bản ghi sân, chặn ca chồng lấn, tạo ca cố định. Không tạo ca băng qua ngày. |
| sp_hold_slot(pitch, slot, date, customer, code) | Kiểm tra sân, ca, khách, thời gian, bảo trì, giá; khóa bản ghi sân rồi giữ ca trong transaction 15 phút; snapshot tiền sân/cọc. |
| sp_confirm_deposit(booking, provider, reference, amount) | Sau khi API đã xác minh chữ ký: đối chiếu số tiền và TTL, ghi payment một lần, chuyển Booking và occupancy sang đã cọc. |
| sp_cancel_booking(booking) | Hủy đơn chưa check-in/hoàn thành, giải phóng ca; không tự chuyển tiền hoàn. |

Các routine tự START TRANSACTION/COMMIT; gọi độc lập, không bọc trong transaction lớn khác. Cùng một pitch được khóa để tuần tự hóa thao tác, phù hợp bài tập quy mô nhỏ. Các chức năng ghi lịch sau này phải dùng routine hoặc cùng giao thức khóa; SQL trực tiếp bỏ qua quy tắc sẽ phá tính nhất quán. Unique PK của occupancy chặn trùng một ca nhưng không tự chặn các ca khác id giao nhau nếu tự ý thêm ca chồng lấn; luôn dùng sp_add_slot.

VietQR chỉ là dữ liệu mã thanh toán; không tự cung cấp webhook. API thanh toán phải chọn nhà cung cấp, xác minh chữ ký, lưu payment_events, sau đó gọi sp_confirm_deposit. Sai/thiếu/thừa tiền hoặc giao dịch đến sau TTL cần lưu và đưa vào đối soát; routine từ chối cập nhật Booking, không tự coi tiền đã hoàn. Secret ngân hàng chỉ lưu tên biến môi trường secretEnvKey, không lưu khóa thật.

## Các quy tắc cần API tương ứng thực hiện

Database đã có cấu trúc nhưng chưa triển khai các API ghi của toàn hệ thống. Thành viên phụ trách cần:

- Đăng ký/đăng nhập: chuẩn hóa email, hash Argon2 hoặc bcrypt, so sánh hash, kiểm tra LOCKED, phân quyền và hash refresh token. Hai user seed là fixture với passwordHash DISABLED_FIXTURE, không có mật khẩu đăng nhập thật.
- Quản trị bảng giá/ca: dùng transaction và khóa pitch khi sửa, kiểm tra chồng khoảng giá, không sửa/xóa ca có lịch sử; dùng trạng thái ngừng hoạt động thay vì xóa dữ liệu tham chiếu.
- Bán/thuê dịch vụ: khóa inventory trước khi giữ/trừ/trả hàng, không bán vượt quantity-reserved; ghi stock_movements và dòng đơn trong cùng transaction. Hàng thuê trả lại phải tăng quantity và cập nhật returnedQuantity đúng một lần. sp_hold_slot hiện chỉ giữ sân, không giữ hàng.
- Hoàn tiền: khóa payment trước khi duyệt/ghi hoàn, tổng các refund hợp lệ không vượt khoản đã nhận; chỉ PAID khi có xác nhận thực sự. CHECK không thể thay thế ràng buộc tổng nhiều dòng này.
- Check-in/quyết toán: kiểm tra trạng thái, thu phần còn lại sau cọc và dịch vụ; lưu người thu, biên nhận và không ghi trùng giao dịch. Đặt tại chỗ có thể dùng booking source WALK_IN nhưng cần API riêng với chính sách cọc phù hợp.
- Đánh giá: kiểm tra Booking đã COMPLETED và thuộc user gửi. UNIQUE bookingId chỉ chặn đánh giá trùng, không tự kiểm tra quyền sở hữu.
- Audit và thông báo: ghi các thao tác nhạy cảm; chỉ cấp quyền đọc audit theo vai trò, hạn chế sửa/xóa audit trong triển khai thật.

## Báo cáo

v_cash_events hợp nhất tiền nhận thành công và khoản hoàn PAID. v_daily_cashflow nhóm theo ngày Việt Nam, có grossCollected, refunded và netCollected; đây là DÒNG TIỀN THỰC THU, không phải báo cáo doanh thu ghi nhận theo chuẩn kế toán. Khoản hoàn được trừ ở ngày thực trả hoàn. v_low_stock cảnh báo theo quantity-reserved<=minQuantity.

## Kiểm chứng và giới hạn

Đã kiểm tra tĩnh đủ 29 bảng và 39 khóa ngoại đều tham chiếu tên bảng đã định nghĩa. Đây không phải kiểm tra thực thi SQL. Đã cài dependency bằng npm ci, build backend NestJS, chạy 3 test Vitest (1 test gốc và 2 test kiểm tra đầu vào), build frontend TypeScript/Vite. Chưa chạy được MySQL server trong môi trường thực hiện nên CHƯA xác nhận schema, procedure, seed hoặc API MySQL bằng chạy thực tế. Không sử dụng kết quả 8 test SQLite trước đây để khẳng định bản MySQL đã đạt.

Có kèm script backend/scripts/db-check.mjs để kiểm tra trên database DEMO sau khi khởi tạo. Script sẽ tạo/xóa các dòng TEST- có prefix thời gian, nên chỉ chạy trên database thử nghiệm:

```sh
cd backend
DB_ALLOW_TESTS=true npm run db:check
```

Script kiểm tra 29 bảng, hai yêu cầu giữ cùng ca chỉ một thành công, số tiền cọc, idempotency, FK sân/ca, tồn kho không âm và hủy giải phóng ca. Nó chưa được chạy trên MySQL trong môi trường này. Dùng demo có sẵn sân 1, ca 1, user 2; nếu seed của bạn khác thì chỉnh các id trong script. Sau đó kiểm tra thêm API /api/pitches, /api/pitches/1 và /api/pitches/1/schedule?date=YYYY-MM-DD. Giao diện chưa được kiểm tra bằng trình duyệt.

## Từ điển dữ liệu

### roles

```sql
id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(30) NOT NULL UNIQUE, name VARCHAR(100) NOT NULL
```

### permissions

```sql
id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(80) NOT NULL UNIQUE, description VARCHAR(255)
```

### role_permissions

```sql
roleId INT NOT NULL, permissionId INT NOT NULL, PRIMARY KEY(roleId,permissionId), FOREIGN KEY(roleId) REFERENCES roles(id), FOREIGN KEY(permissionId) REFERENCES permissions(id)
```

### users

```sql
id INT PRIMARY KEY AUTO_INCREMENT, fullName VARCHAR(120) NOT NULL,
email VARCHAR(190) NOT NULL UNIQUE, phone VARCHAR(30), passwordHash VARCHAR(255) NOT NULL,
status ENUM('ACTIVE','LOCKED') NOT NULL DEFAULT 'ACTIVE',
createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

### user_roles

```sql
userId INT NOT NULL, roleId INT NOT NULL, PRIMARY KEY(userId,roleId), FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(roleId) REFERENCES roles(id)
```

### refresh_tokens

```sql
id BIGINT PRIMARY KEY AUTO_INCREMENT, userId INT NOT NULL, tokenHash CHAR(64) NOT NULL UNIQUE, expiresAt DATETIME NOT NULL, revokedAt DATETIME, FOREIGN KEY(userId) REFERENCES users(id), INDEX(userId,expiresAt)
```

### complexes

```sql
id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, address VARCHAR(255) NOT NULL, district VARCHAR(100) NOT NULL, contact VARCHAR(60), image VARCHAR(1000), description TEXT, INDEX(district)
```

### pitches

```sql
id INT PRIMARY KEY AUTO_INCREMENT, complexId INT NOT NULL, name VARCHAR(100) NOT NULL,
type INT NOT NULL CHECK(type IN (5,7,11)), grass VARCHAR(150), lights VARCHAR(150),
status ENUM('ACTIVE','MAINTENANCE','INACTIVE') NOT NULL DEFAULT 'ACTIVE', image VARCHAR(1000),
FOREIGN KEY(complexId) REFERENCES complexes(id), UNIQUE(complexId,name), INDEX(status,type,complexId)
```

### pitch_images

```sql
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL, url VARCHAR(1000) NOT NULL, caption VARCHAR(255), sortOrder INT NOT NULL DEFAULT 0, FOREIGN KEY(pitchId) REFERENCES pitches(id)
```

### amenities

```sql
id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(100) NOT NULL UNIQUE
```

### pitch_amenities

```sql
pitchId INT NOT NULL, amenityId INT NOT NULL, PRIMARY KEY(pitchId,amenityId), FOREIGN KEY(pitchId) REFERENCES pitches(id), FOREIGN KEY(amenityId) REFERENCES amenities(id), INDEX(amenityId,pitchId)
```

### holidays

```sql
date DATE PRIMARY KEY, name VARCHAR(150) NOT NULL
```

### prices

```sql
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL,
dayType ENUM('WEEKDAY','WEEKEND','HOLIDAY') NOT NULL, `start` CHAR(5) NOT NULL, `end` CHAR(5) NOT NULL,
amount INT NOT NULL CHECK(amount>0), depositPercent INT NOT NULL DEFAULT 30 CHECK(depositPercent BETWEEN 1 AND 100),
CHECK(`start`<`end`), CHECK(`start` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'), CHECK(`end` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
FOREIGN KEY(pitchId) REFERENCES pitches(id), UNIQUE(pitchId,dayType,`start`,`end`)
```

### slots

```sql
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL, `start` CHAR(5) NOT NULL, `end` CHAR(5) NOT NULL,
CHECK(`start`<`end`), CHECK(`start` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'), CHECK(`end` REGEXP '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
FOREIGN KEY(pitchId) REFERENCES pitches(id), UNIQUE(pitchId,`start`,`end`), UNIQUE(id,pitchId)
```

### pitch_blocks

```sql
id INT PRIMARY KEY AUTO_INCREMENT, pitchId INT NOT NULL, startsAt DATETIME NOT NULL, endsAt DATETIME NOT NULL, reason VARCHAR(255) NOT NULL, CHECK(startsAt<endsAt), FOREIGN KEY(pitchId) REFERENCES pitches(id), INDEX(pitchId,startsAt,endsAt)
```

### bookings

```sql
id INT PRIMARY KEY AUTO_INCREMENT, code VARCHAR(50) NOT NULL UNIQUE,
pitchId INT NOT NULL, slotId INT NOT NULL, date DATE NOT NULL, customerId INT,
guestName VARCHAR(120), guestPhone VARCHAR(30), createdBy INT,
source ENUM('ONLINE','WALK_IN') NOT NULL DEFAULT 'ONLINE',
status ENUM('PENDING_DEPOSIT','DEPOSIT_PAID','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED') NOT NULL,
pitchAmount INT NOT NULL CHECK(pitchAmount>0), depositDue INT NOT NULL CHECK(depositDue>0 AND depositDue<=pitchAmount),
expiresAt DATETIME, checkedInAt DATETIME, completedAt DATETIME, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(slotId,pitchId) REFERENCES slots(id,pitchId), FOREIGN KEY(customerId) REFERENCES users(id), FOREIGN KEY(createdBy) REFERENCES users(id),
INDEX(pitchId,date,status), INDEX(customerId,createdAt), INDEX(status,expiresAt)
```

### slot_occupancy

```sql
pitchId INT NOT NULL, slotId INT NOT NULL, date DATE NOT NULL, bookingId INT UNIQUE,
state ENUM('HELD','CONFIRMED') NOT NULL, expiresAt DATETIME,
PRIMARY KEY(pitchId,slotId,date), FOREIGN KEY(slotId,pitchId) REFERENCES slots(id,pitchId), FOREIGN KEY(bookingId) REFERENCES bookings(id),
CHECK((state='HELD' AND expiresAt IS NOT NULL) OR (state='CONFIRMED' AND expiresAt IS NULL)), INDEX(state,expiresAt)
```

### services

```sql
id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(150) NOT NULL, kind ENUM('SALE','RENTAL') NOT NULL,
unit VARCHAR(30) NOT NULL, price INT NOT NULL CHECK(price>=0), active BOOLEAN NOT NULL DEFAULT TRUE, image VARCHAR(1000)
```

### inventory

```sql
complexId INT NOT NULL, serviceId INT NOT NULL, quantity INT NOT NULL DEFAULT 0, reserved INT NOT NULL DEFAULT 0,
minQuantity INT NOT NULL DEFAULT 0, PRIMARY KEY(complexId,serviceId),
CHECK(quantity>=0 AND reserved>=0 AND reserved<=quantity AND minQuantity>=0), FOREIGN KEY(complexId) REFERENCES complexes(id), FOREIGN KEY(serviceId) REFERENCES services(id)
```

### stock_movements

```sql
id BIGINT PRIMARY KEY AUTO_INCREMENT, complexId INT NOT NULL, serviceId INT NOT NULL, delta INT NOT NULL CHECK(delta<>0),
kind ENUM('RECEIPT','SALE','LOSS','RENT_OUT','RENT_RETURN','ADJUSTMENT') NOT NULL, unitCost INT CHECK(unitCost>=0),
reference VARCHAR(100), note VARCHAR(255), createdBy INT, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(complexId,serviceId) REFERENCES inventory(complexId,serviceId), FOREIGN KEY(createdBy) REFERENCES users(id), INDEX(complexId,serviceId,createdAt)
```

### service_orders

```sql
id INT PRIMARY KEY AUTO_INCREMENT, bookingId INT, complexId INT NOT NULL, createdBy INT,
status ENUM('DRAFT','CONFIRMED','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT', createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(bookingId) REFERENCES bookings(id), FOREIGN KEY(complexId) REFERENCES complexes(id), FOREIGN KEY(createdBy) REFERENCES users(id)
```

### service_order_items

```sql
id INT PRIMARY KEY AUTO_INCREMENT, orderId INT NOT NULL, serviceId INT NOT NULL,
quantity INT NOT NULL CHECK(quantity>0), unitPrice INT NOT NULL CHECK(unitPrice>=0),
returnedQuantity INT NOT NULL DEFAULT 0 CHECK(returnedQuantity>=0 AND returnedQuantity<=quantity),
FOREIGN KEY(orderId) REFERENCES service_orders(id), FOREIGN KEY(serviceId) REFERENCES services(id), UNIQUE(orderId,serviceId)
```

### bank_accounts

```sql
id INT PRIMARY KEY AUTO_INCREMENT, complexId INT NOT NULL, bankCode VARCHAR(30) NOT NULL, accountNumber VARCHAR(50) NOT NULL,
accountName VARCHAR(150) NOT NULL, provider VARCHAR(50) NOT NULL, secretEnvKey VARCHAR(100), active BOOLEAN NOT NULL DEFAULT TRUE,
FOREIGN KEY(complexId) REFERENCES complexes(id), UNIQUE(complexId,bankCode,accountNumber)
```

### payments

```sql
id INT PRIMARY KEY AUTO_INCREMENT, bookingId INT, serviceOrderId INT,
purpose ENUM('DEPOSIT','SETTLEMENT','SERVICE') NOT NULL, method ENUM('CASH','BANK_QR') NOT NULL,
provider VARCHAR(50) NOT NULL, providerReference VARCHAR(120) NOT NULL, amount INT NOT NULL CHECK(amount>0),
status ENUM('PENDING','SUCCEEDED','FAILED') NOT NULL, paidAt DATETIME, receivedBy INT, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
CHECK((bookingId IS NOT NULL AND serviceOrderId IS NULL) OR (bookingId IS NULL AND serviceOrderId IS NOT NULL)),
CHECK((status='SUCCEEDED' AND paidAt IS NOT NULL) OR status<>'SUCCEEDED'),
FOREIGN KEY(bookingId) REFERENCES bookings(id), FOREIGN KEY(serviceOrderId) REFERENCES service_orders(id), FOREIGN KEY(receivedBy) REFERENCES users(id),
UNIQUE(provider,providerReference), INDEX(status,paidAt)
```

### payment_events

```sql
id BIGINT PRIMARY KEY AUTO_INCREMENT, provider VARCHAR(50) NOT NULL, eventId VARCHAR(120) NOT NULL,
paymentId INT, signatureValid BOOLEAN NOT NULL, payload JSON NOT NULL,
status ENUM('RECEIVED','PROCESSED','REJECTED','NEEDS_REVIEW') NOT NULL DEFAULT 'RECEIVED',
receivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(paymentId) REFERENCES payments(id), UNIQUE(provider,eventId)
```

### refunds

```sql
id INT PRIMARY KEY AUTO_INCREMENT, paymentId INT NOT NULL, amount INT NOT NULL CHECK(amount>0),
reason VARCHAR(255) NOT NULL, status ENUM('REQUESTED','APPROVED','PAID','REJECTED','FAILED') NOT NULL DEFAULT 'REQUESTED',
requestedBy INT, approvedBy INT, providerReference VARCHAR(120) UNIQUE, requestedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, paidAt DATETIME,
CHECK(status<>'PAID' OR paidAt IS NOT NULL), FOREIGN KEY(paymentId) REFERENCES payments(id), FOREIGN KEY(requestedBy) REFERENCES users(id), FOREIGN KEY(approvedBy) REFERENCES users(id), INDEX(status,paidAt)
```

### reviews

```sql
id INT PRIMARY KEY AUTO_INCREMENT, bookingId INT NOT NULL UNIQUE, userId INT NOT NULL,
rating INT NOT NULL CHECK(rating BETWEEN 1 AND 5), content TEXT, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(bookingId) REFERENCES bookings(id), FOREIGN KEY(userId) REFERENCES users(id)
```

### audit_logs

```sql
id BIGINT PRIMARY KEY AUTO_INCREMENT, actorId INT, action VARCHAR(100) NOT NULL, entityType VARCHAR(80) NOT NULL,
entityId VARCHAR(80), beforeData JSON, afterData JSON, ip VARCHAR(45), createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(actorId) REFERENCES users(id), INDEX(entityType,entityId,createdAt), INDEX(actorId,createdAt)
```

### notifications

```sql
id BIGINT PRIMARY KEY AUTO_INCREMENT, userId INT NOT NULL, bookingId INT, title VARCHAR(150) NOT NULL,
content TEXT NOT NULL, readAt DATETIME, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
FOREIGN KEY(userId) REFERENCES users(id), FOREIGN KEY(bookingId) REFERENCES bookings(id), INDEX(userId,readAt)
```

## Tài liệu đối chiếu

MySQL CHECK constraints: https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html

Các bảng, routine và mã nguồn là phần cài đặt của dự án này; tài liệu tham chiếu chỉ giải thích cơ chế CHECK.
