import { useApp } from "../../lib/AppContext";

export default function AuthForm({ mode: page }: { mode: "login" | "register" }) {
  const { navigate, setNotice } = useApp();
  return (
    <div className="auth-wrap">
      <div className="auth-visual">
        <span className="eyebrow">SPORTSPACE</span>
        <h1>
          Mỗi trận đấu
          <br />
          bắt đầu từ một
          <br />
          <em>lựa chọn tốt.</em>
        </h1>
        <p>Thiết kế giao diện tài khoản cho hệ thống quản lý sân bóng.</p>
      </div>
      <section className="panel auth-panel">
        <span className="eyebrow">TÀI KHOẢN · GIAO DIỆN MẪU</span>
        <h1>{page === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}</h1>
        <p className="muted">
          {page === "login"
            ? "Nhập thông tin để xem bố cục đăng nhập."
            : "Điền thông tin để xem bố cục đăng ký."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(
              "Đây là bản mẫu giao diện. Hệ thống chưa có API xác thực để gửi biểu mẫu.",
            );
          }}
          className="auth-form"
        >
          {page === "register" && (
            <label>
              Họ và tên
              <input required autoComplete="name" placeholder="Nguyễn Văn A" />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
            />
          </label>
          {page === "register" && (
            <label>
              Số điện thoại
              <input
                required
                type="tel"
                autoComplete="tel"
                placeholder="090 000 0000"
              />
            </label>
          )}
          <label>
            Mật khẩu
            <input
              required
              type="password"
              minLength={6}
              autoComplete={
                page === "login" ? "current-password" : "new-password"
              }
              placeholder="Ít nhất 6 ký tự"
            />
          </label>
          <button className="primary full">
            {page === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        </form>
        <p className="auth-switch">
          {page === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button
            className="text-button"
            onClick={() => navigate(page === "login" ? "register" : "login")}
          >
            {page === "login" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </p>
      </section>
    </div>
  );
}
