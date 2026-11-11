# Giao diện quản lý sân bóng

React + TypeScript + Vite. Tìm sân, chi tiết sân, bảng giá và lịch trống dùng API NestJS. UC2.1 Dashboard và UC2.6 quản lý nhân sự/nhật ký đã được nối API trong bản vá của Hào; cần chạy MySQL thực và hoàn thành các phân hệ thanh toán/hoàn cọc để có đủ số liệu báo cáo.

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
| `/#/dashboard`, `/#/users`, `/#/audit` | UC2.1/UC2.6 gọi API, chỉ tài khoản có quyền phù hợp được truy cập dữ liệu. Xem `HUONG_DAN_HAO_UC21_UC26.md` ở thư mục gốc. |
| Trang chủ, VietQR, ma trận quản trị | Còn phần giao diện minh họa. Chức năng đăng nhập, đặt sân, danh mục sân đã có API trong ZIP gốc; cần nhóm chạy thử tích hợp. |

Các trang mẫu còn lại dùng dữ liệu trong `src/mocks/demoData.ts`; dữ liệu này **không được dùng** trong UC1.2, UC2.1, UC2.6. Mỗi trang nằm riêng ở `src/pages/`; API UC2.1/UC2.6 nằm trong `src/features/admin/api.ts`. Xem bảng sở hữu thư mục ở [CAU_TRUC_PHAN_CONG.md](../CAU_TRUC_PHAN_CONG.md).
# Giao diện quản lý sân bóng

React + TypeScript + Vite. Tìm sân, chi tiết sân, bảng giá và lịch trống dùng API NestJS. UC2.1 Dashboard và UC2.6 quản lý nhân sự/nhật ký đã được nối API trong bản vá của Hào; cần chạy MySQL thực và hoàn thành các phân hệ thanh toán/hoàn cọc để có đủ số liệu báo cáo.

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
| `/#/dashboard`, `/#/users`, `/#/audit` | UC2.1/UC2.6 gọi API, chỉ tài khoản có quyền phù hợp được truy cập dữ liệu. Xem `HUONG_DAN_HAO_UC21_UC26.md` ở thư mục gốc. |
| Trang chủ, VietQR, ma trận quản trị | Còn phần giao diện minh họa. Chức năng đăng nhập, đặt sân, danh mục sân đã có API trong ZIP gốc; cần nhóm chạy thử tích hợp. |

Các trang mẫu còn lại dùng dữ liệu trong `src/mocks/demoData.ts`; dữ liệu này **không được dùng** trong UC1.2, UC2.1, UC2.6. Mỗi trang nằm riêng ở `src/pages/`; API UC2.1/UC2.6 nằm trong `src/features/admin/api.ts`. Xem bảng sở hữu thư mục ở [CAU_TRUC_PHAN_CONG.md](../CAU_TRUC_PHAN_CONG.md).
