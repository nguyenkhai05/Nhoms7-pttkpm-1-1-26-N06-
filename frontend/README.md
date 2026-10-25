# Giao diện quản lý sân bóng

React + TypeScript + Vite. Trang chủ và các trang ngoài UC1.2 là **bản mẫu giao diện**. Tìm sân, chi tiết sân, bảng giá và lịch trống dùng API NestJS thật; khi API lỗi, trang hiển thị thông báo lỗi thay vì dữ liệu giả.

## Chạy

Từ thư mục `frontend`:

```bash
npm ci
npm run dev
```

Mở URL Vite in trong terminal (thường là `http://localhost:5173/`). Dùng `/#/search` để xem danh sách sân, lọc và mở chi tiết; link chi tiết có dạng `/#/detail?id=1`. Vite chuyển tiếp `/api` đến backend trên cổng 3000. Muốn xem dữ liệu thật, cần khởi động MySQL và NestJS theo [README_UC12.md](../README_UC12.md).

## Phạm vi của giao diện

| Trang | Trạng thái |
|---|---|
| `/#/search` và `/#/detail?id=1` | API UC1.2 thật: tìm kiếm, xem giá, ma trận lịch xanh/vàng/đỏ; chọn ca chỉ chuyển mã sân/ngày/ca sang màn hình đặt sân mẫu. |
| Trang chủ, đăng nhập, đăng ký, đặt sân, VietQR, quản trị sân, ma trận quản trị, dashboard | Bố cục minh họa. Chưa có API của các issue tương ứng; không tạo tài khoản, đơn đặt sân, giao dịch hoặc QR thật. |

Các trang mẫu khác dùng dữ liệu trong `src/mocks/demoData.ts`; dữ liệu này **không được dùng** trong tìm sân và lịch trống UC1.2. Mỗi trang nằm riêng ở `src/pages/`; component và API UC1.2 nằm trong `src/features/pitches/`. Xem bảng sở hữu thư mục ở [CAU_TRUC_PHAN_CONG.md](../CAU_TRUC_PHAN_CONG.md). Không dán thêm code vào đầu `src/App.tsx` cũ: dùng nguyên file của bản tích hợp khi đưa vào repo.
