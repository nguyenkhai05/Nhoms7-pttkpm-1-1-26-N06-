import { useState } from "react";
import axios from "axios";
import { useApp } from "../../lib/AppContext";

export default function AuthForm({ mode: page }: { mode: "login" | "register" }) {
  const { navigate, setNotice } = useApp();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (page === "register") {
        await axios.post("http://localhost:3000/api/auth/register", {
          username: email, // Backend bắt buộc username
          email,
          fullName,
          password,
          phone,
        });

        setNotice("Đăng ký tài khoản thành công! Vui lòng đăng nhập.");
        navigate("login");
      } else {
        const response = await axios.post("http://localhost:3000/api/auth/login", {
          username: email, // Backend LoginDto nhận username
          password,
        });

        const { accessToken, user } = response.data;
        if (accessToken) {
          localStorage.setItem("accessToken", accessToken);
        }
        if (user) {
          localStorage.setItem("user", JSON.stringify(user));
        }

        setNotice("Đăng nhập thành công!");
        navigate("home");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại!";
      setNotice(Array.isArray(errorMessage) ? errorMessage.join(", ") : errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
        <span className="eyebrow">TÀI KHOẢN</span>
        <h1>{page === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}</h1>
        <p className="muted">
          {page === "login"
            ? "Nhập thông tin để tiếp tục vào hệ thống."
            : "Điền thông tin để đăng ký tài khoản mới."}
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          {page === "register" && (
            <label>
              Họ và tên
              <input
                required
                autoComplete="name"
                placeholder="Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary full" disabled={loading}>
            {loading ? "Đang xử lý..." : page === "login" ? "Đăng nhập" : "Đăng ký"}
          </button>
        </form>
        <p className="auth-switch">
          {page === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{" "}
          <button
            className="text-button"
            type="button"
            onClick={() => navigate(page === "login" ? "register" : "login")}
          >
            {page === "login" ? "Đăng ký" : "Đăng nhập"}
          </button>
        </p>
      </section>
    </div>
  );
}