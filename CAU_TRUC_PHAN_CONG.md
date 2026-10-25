# Cấu trúc dự án và phân công theo cặp issue

Bản này áp dụng cách tổ chức của bài tham khảo: **màn hình** ở `frontend/src/pages`, mã nghiệp vụ và API theo **tính năng** ở `frontend/src/features`, phần dùng chung ở `components` và `lib`; backend có một thư mục NestJS cho mỗi nhóm chức năng. Mã nghiệp vụ và database của bài tham khảo không được sao chép sang dự án này vì schema và quy tắc khác nhau.

## Cấu trúc chính

```text
frontend/src/
  App.tsx                   # Chỉ chọn trang theo hash route
  pages/                    # Mỗi màn hình một file
  features/pitches/         # UC1.2 thật: API, types, các component sân/lịch
  features/auth/            # Form chung; API xác thực do nhóm triển khai
  features/{catalog,bookings,payments,schedule-admin,dashboard,home}/
  components/               # SiteLayout, PageHead, Metric, DemoBanner dùng chung
  lib/                      # Điều hướng, trạng thái bàn giao ca, format
  mocks/                    # Dữ liệu mẫu chỉ cho các issue chưa có API
  styles/                   # CSS nền hiện có; trang mới có thể dùng CSS riêng
backend/src/
  database/                 # Module MySQL dùng chung, một connection pool
  pitch/                    # UC1.2 thật: controller, service, repository, model
  {auth,catalog,bookings,payments,schedule-admin,dashboard,home}/
database/                   # Schema, procedure và seed MySQL hiện có
```

`App.tsx` vẫn dùng hash route như bản nhóm đang chạy (`/#/search`, `/#/detail?id=1`). Không thêm `react-router-dom` hoặc đổi URL trong lần tách cấu trúc này. Các controller/service/repository/model UC1.2 giữ nguyên tên trong `backend/src/pitch`; lớp `MysqlDatabase` được chuyển sang `backend/src/database` để các module tương lai dùng cùng một pool. Vì vậy khi nộp báo cáo giai đoạn 3, cập nhật đường dẫn ánh xạ của lớp này. Mỗi thư mục chức năng mới có README hướng dẫn đầu việc; **chưa có module/API nghiệp vụ mới** ở đó.

## Chủ sở hữu theo cặp backend và frontend

| Cặp issue | Backend sở hữu | Frontend sở hữu | Trạng thái |
|---|---|---|---|
| Tìm sân và lịch trống UC1.2 | `backend/src/pitch/` | `features/pitches/`, `pages/PitchListPage.tsx`, `pages/PitchDetailPage.tsx` | Đã nối API; cần xác nhận MySQL thật |
| Đăng ký và đăng nhập | `backend/src/auth/` | `features/auth/`, `pages/LoginPage.tsx`, `pages/RegisterPage.tsx` | Form mẫu |
| Danh mục sân và bảng giá | `backend/src/catalog/` | `features/catalog/`, `pages/CatalogPage.tsx` | Trang mẫu |
| Đặt sân và chọn dịch vụ | `backend/src/bookings/` | `features/bookings/`, `pages/BookingPage.tsx` | Trang mẫu |
| Thanh toán cọc VietQR | `backend/src/payments/` | `features/payments/`, `pages/PaymentPage.tsx` | Trang mẫu, không có QR thật |
| Ma trận lịch và đặt tại chỗ | `backend/src/schedule-admin/` | `features/schedule-admin/`, `pages/AdminSchedulePage.tsx` | Trang mẫu |
| Dashboard | `backend/src/dashboard/` | `features/dashboard/`, `pages/DashboardPage.tsx` | Trang mẫu |
| Trang chủ | `backend/src/home/` nếu cần API riêng | `features/home/`, `pages/HomePage.tsx` | Trang mẫu |

## Quy tắc để nhiều người làm cùng lúc

1. Mỗi cặp issue làm trên một nhánh riêng từ cùng một nhánh tích hợp. Ví dụ `feat/auth`, `feat/catalog`, `feat/bookings`, `feat/payments`.
2. Người làm backend thêm `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` và repository trong thư mục mình phụ trách, rồi cập nhật **một dòng import module** ở `backend/src/app.module.ts` khi sẵn sàng. Không tạo route giả trả dữ liệu mẫu.
3. Người làm frontend chỉnh trang của mình và các file trong `features/<tính năng>/`. Mỗi tính năng tạo hàm gọi API riêng ở đó. `mocks/demoData.ts` chỉ phục vụ bản mẫu; khi hoàn thành thì bỏ dữ liệu mẫu khỏi trang mình.
4. Chỉ người tích hợp chung sửa điều hướng `frontend/src/App.tsx`, `frontend/src/lib/routes.ts`, layout chung hoặc CSS nền. Nếu cần thêm route, thống nhất trước để tránh nhiều PR cùng sửa một file.
5. PR của một cặp issue phải có hợp đồng API, một luồng thành công, một luồng lỗi, kiểm thử phù hợp và xác nhận dữ liệu MySQL thật. Chức năng đặt sân/giữ ca và thanh toán cần kiểm tra xử lý trùng.

## Thứ tự phụ thuộc

Đăng ký/đăng nhập và danh mục sân có thể làm song song. Đặt sân cần dữ liệu sân, ca và giá; thanh toán cọc cần đơn đặt sân hợp lệ. Ma trận quản trị có thể phát triển cùng giai đoạn đặt sân. Dashboard cần dữ liệu đơn và thanh toán. Trang chủ có thể làm song song bằng API tìm sân đã có.

## Kiểm tra sau khi tách cấu trúc

Backend và frontend vẫn build được; backend giữ nguyên API UC1.2. Frontend giữ URL cũ và các trang mẫu hiện có. Việc tách thư mục **không đồng nghĩa các issue ngoài UC1.2 đã hoàn thành**. Chưa chạy MySQL và chưa kiểm tra trực quan bằng trình duyệt trong môi trường tạo bản này; nhóm nên chạy theo `README_UC12.md` trước khi gộp vào `main`.
