# Kết nối MySQL dùng chung

`DatabaseModule` cấp một `MysqlDatabase` và một connection pool cho các module NestJS nhập module này. Người làm tính năng mới nên import `DatabaseModule`, inject `MysqlDatabase`, và để câu SQL trong repository của tính năng mình. Không khởi tạo pool riêng trong mỗi controller hoặc service.

Schema và dữ liệu mẫu nằm ở thư mục `database/` cấp gốc. Trước khi thay đổi schema, thống nhất migration với cả nhóm để các tính năng không dùng hai định nghĩa bảng khác nhau.
