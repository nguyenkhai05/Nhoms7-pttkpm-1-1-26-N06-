# SportSpace - hệ thống quản lý sân bóng

Backend NestJS truy vấn MySQL và dùng Redis để giữ ca; frontend React TypeScript dùng proxy `/api` từ Vite. Các phần quản trị có Dashboard, quản lý nhân sự, Audit Log, sân và bảng giá, kho, lịch sân và giao dịch. QR và xác nhận cọc hiện có chế độ **mô phỏng**, không phải giao dịch ngân hàng thật.

## Chạy trong Codespaces

1. Ở thư mục gốc, tạo `.env` từ `.env.example` và đặt `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` của riêng bạn. Giữ file `.env` ngoài Git.
2. Chạy `docker compose up -d` và chờ `docker compose ps` báo MySQL `healthy`. Khi volume mới được tạo, image chạy lần lượt `database/01_schema.sql`, `02_procedures.sql`, `03_seed.sql`. Nếu dùng MySQL Workbench, xem hướng dẫn nhập SQL tại `database/README_DATABASE.md`.
3. Trong `backend`, tạo `.env` từ `.env.example`, đặt `DB_PASSWORD` giống ở bước 1 và thay các giá trị `SEED_*_PASSWORD`; chạy `npm ci`, `npm run seed:staff`, rồi `npm run start:dev`. Backend chạy cổng 3000. File `backend/pitch.sqlite` từ ZIP cũ không được backend MySQL sử dụng.
4. Trong `frontend`, chạy `npm ci` rồi `npm run dev`, mở cổng 5173 và truy cập `/#/search`. Đăng nhập và các API frontend đi qua proxy `/api`, phù hợp khi mở cổng frontend từ Codespaces.
5. Với database đã tạo từ bản cũ, chỉ chạy `database/05_demo_extensions_existing_db.sql` **một lần**, rồi chạy lại `database/02_procedures.sql`; xem `database/README_DATABASE.md`. Không chạy migration này với database mới.
6. Trước demo: chạy `npm run build`, `npm test` và `npm run test:e2e` trong `backend`; chạy `npm run build` trong `frontend`. Các kiểm thử hiện có dùng stub cho MySQL/Redis; hãy thử thủ công các luồng đặt sân, cọc, check-in và hoàn tiền trên môi trường MySQL/Redis thật.

Thử API độc lập với trình duyệt:

```bash
curl 'http://localhost:3000/api/pitches?type=7&district=H%C3%A0%20%C4%90%C3%B4ng'
curl 'http://localhost:3000/api/pitches/1'
curl 'http://localhost:3000/api/pitches/1/schedule?date=2026-10-26'
```

Hãy thay ngày ở lệnh cuối bằng **ngày mai theo giờ Việt Nam** lúc bạn khởi tạo database. Seed đánh dấu ca 17:00 đỏ (đã cọc) và ca 18:30 vàng (giữ tạm tối đa 15 phút); sau đó ca vàng hết hạn và trở lại xanh nếu chưa có đặt chỗ khác.

## Ánh xạ phần đã cài đặt

| Phần | Mã nguồn |
|---|---|
| API GET `/api/pitches`, GET `/api/pitches/:id` | `backend/src/pitch/controllers/pitchController.ts` |
| API GET `/api/pitches/:id/schedule?date=YYYY-MM-DD` | `backend/src/pitch/controllers/scheduleController.ts` |
| Kiểm tra bộ lọc và chi tiết | `backend/src/pitch/services/pitchService.ts` |
| Tính màu ca, giá, ngày lễ, bảo trì | `backend/src/pitch/services/scheduleService.ts` |
| SQL truy vấn cụm/sân/giá/tiện ích/ca/occupancy | `backend/src/pitch/repositories/pitchRepository.ts` |
| Kết nối MySQL dùng chung | `backend/src/database/database.module.ts`, `backend/src/database/mysqlDatabase.ts`; schema/seed trong `database/` |
| Tìm kiếm, thẻ sân, chi tiết và lịch | `frontend/src/pages/PitchListPage.tsx`, `frontend/src/pages/PitchDetailPage.tsx`, `frontend/src/features/pitches/` |

## Kiểm chứng và giới hạn

Các API và trang quản trị cần được thử với MySQL/Redis theo cấu hình trên. Dashboard tổng hợp các khoản đã thu và hoàn theo kỳ; khoản thu của sân/dịch vụ được phân bổ theo tỷ trọng trong đơn. Lịch sử khả năng khai thác của sân trước thời điểm đổi trạng thái chưa được lưu riêng, nên tỷ lệ lấp đầy cho giai đoạn trước khi đổi trạng thái sân cần đối chiếu thủ công. Không dùng nút thanh toán demo để xác nhận giao dịch ngân hàng thật.
