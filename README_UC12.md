# Tích hợp issue: tìm kiếm sân và xem chi tiết lịch trống

Đây là bản sửa trên ZIP mã nguồn hiện tại của nhóm. Backend NestJS truy vấn MySQL; frontend React TypeScript hiển thị cùng phong cách với bản giao diện mẫu SportSpace.

## Chạy trong Codespaces

1. Ở thư mục gốc, tạo `.env` từ `.env.example` và đặt `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` của riêng bạn. Giữ file `.env` ngoài Git.
2. Chạy `docker compose up -d` và chờ `docker compose ps` báo MySQL `healthy`. Khi volume mới được tạo, image chạy lần lượt `database/01_schema.sql`, `02_procedures.sql`, `03_seed.sql`. Nếu dùng MySQL Workbench, xem hướng dẫn nhập SQL tại `database/README_DATABASE.md`.
3. Trong `backend`, tạo `.env` từ `.env.example`, đặt `DB_PASSWORD` giống ở bước 1, chạy `npm ci` rồi `npm run start:dev`. Backend chạy cổng 3000. File `backend/pitch.sqlite` từ ZIP cũ không được backend MySQL sử dụng.
4. Trong `frontend`, chạy `npm ci` rồi `npm run dev`, mở cổng 5173 và truy cập `/#/search`.

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

Trong môi trường tạo bản sửa: `npm run build` của backend và frontend đạt; `npm test` của backend đạt 8 kiểm thử (bộ lọc, màu lịch, giá ngày lễ, ba HTTP endpoint, đầu vào không hợp lệ và liên kết module database). Sau đó frontend được tách theo `pages/features/components/lib` và build lại thành công. **Chưa chạy MySQL thực tế ở môi trường này**, nên hãy thực hiện bốn bước chạy ở trên và xác nhận dữ liệu từ database của nhóm trước khi đóng issue. Trang đặt sân sau khi chọn ca và mọi màn hình ngoài UC1.2 vẫn là bản mẫu, không ghi dữ liệu.
