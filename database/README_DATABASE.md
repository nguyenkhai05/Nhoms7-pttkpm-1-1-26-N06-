# Hướng dẫn khởi tạo cơ sở dữ liệu

## Cách 1: Docker Compose (khuyến nghị)

1. Tại thư mục gốc, sao chép `.env.example` thành `.env` và đặt `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` bằng mật khẩu mạnh.
2. Chạy `docker compose up -d`.
3. Chờ `docker compose ps` hiển thị MySQL ở trạng thái `healthy`.
4. Các file SQL được Docker chạy tự động theo thứ tự `01_schema.sql`, `02_procedures.sql`, `03_seed.sql` khi volume MySQL được tạo lần đầu.

## Cách 2: MySQL Workbench

Kết nối tới MySQL 8.4, mở lần lượt từng file trong thư mục `database/` và thực thi theo thứ tự:

1. `01_schema.sql` — tạo database, bảng, index, view và constraint.
2. `02_procedures.sql` — tạo stored procedure.
3. `03_seed.sql` — thêm roles, permissions, dữ liệu mẫu và tài khoản VietQR demo.

`05_demo_extensions_existing_db.sql` chỉ chạy **một lần** trên database cũ đã được tạo từ schema trước; không chạy file này trên database mới vì các cột đã có trong `01_schema.sql`. Sau khi chạy migration trên database cũ, chạy lại `02_procedures.sql` để cập nhật procedure.

`04_examples.sql` chỉ chứa truy vấn/thao tác ví dụ, không phải bước bắt buộc để khởi tạo.

## Tạo tài khoản nhân viên

Sau khi database đã được seed, cấu hình `backend/.env` từ `backend/.env.example`, đặt bốn biến `SEED_*_PASSWORD` (tối thiểu 8 ký tự), rồi chạy trong thư mục `backend`:

```bash
npm ci
npm run seed:staff
```

Email mặc định: `admin@example.test`, `manager@example.test`, `reception@example.test`, `accountant@example.test`. Có thể thay email bằng các biến `SEED_*_EMAIL`. Mật khẩu không được ghi vào source code hoặc log.

## Lưu ý dữ liệu

Không chạy `docker compose down -v` trên môi trường có dữ liệu cần giữ vì lệnh này xóa volume MySQL và Redis. Chỉ dùng khi chủ động muốn tạo database sạch từ đầu.
