import type { ReactNode } from "react";
import { useApp } from "../lib/AppContext";
import { links, titles } from "../lib/routes";

export default function SiteLayout({ children }: { children: ReactNode }) {
  const { page, navigate, notice, setNotice } = useApp();
  return (
    <div className="pitch-app">
      <aside className="sidebar">
        <a className="brand" href="#/home">
          <span className="brand-mark">⚽</span>
          <span>
            SPORT<span className="brand-accent">SPACE</span>
            <small>QUẢN LÝ SÂN BÓNG</small>
          </span>
        </a>
        <div className="nav-caption">KHÁCH HÀNG</div>
        <nav aria-label="Điều hướng chính">
          {links.slice(0, 4).map((item) => (
            <a
              key={item.page}
              className={
                page === item.page ||
                (page === "detail" && item.page === "search")
                  ? "active"
                  : ""
              }
              href={"#/" + item.page}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
          <div className="nav-caption">QUẢN TRỊ · GIAO DIỆN MẪU</div>
          {links.slice(4).map((item) => (
            <a
              key={item.page}
              className={page === item.page ? "active" : ""}
              href={"#/" + item.page}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="live-dot" />
          Bản mẫu giao diện
          <br />
          <small>Chức năng chưa có API được minh họa.</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs">
            SportSpace <span>/</span> <strong>{titles[page]}</strong>
          </div>
          <div className="top-actions">
            <span className="today">
              {new Intl.DateTimeFormat("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              }).format(new Date())}
            </span>
            <button className="top-link" onClick={() => navigate("login")}>
              Đăng nhập
            </button>
            <button
              className="avatar"
              aria-label="Tài khoản mẫu"
              onClick={() => navigate("register")}
            >
              S
            </button>
          </div>
        </header>
        <main className="content">
          {children}
          {notice && (
            <div className="toast" role="status">
              <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
                ×
              </button>
              {notice}
            </div>
          )}
        </main>
        <footer>
          © 2026 SportSpace · Bản mẫu giao diện cho đề tài quản lý sân bóng
        </footer>
      </div>
    </div>
  );
}
