import type { ReactNode } from "react";
import { useApp } from "../lib/AppContext";
import { links, titles } from "../lib/routes";
import { useEffect, useState } from "react";
import axios from "axios";

type StoredUser = { fullName: string; roles: string[]; permissions: string[] };

export default function SiteLayout({ children }: { children: ReactNode }) {
  const { page, navigate, notice, setNotice } = useApp();
  const [user, setUser] = useState<StoredUser | null>(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null") as StoredUser | null; }
    catch { return null; }
  });
  useEffect(() => {
    const syncUser = () => {
      try { setUser(JSON.parse(localStorage.getItem("user") || "null") as StoredUser | null); }
      catch { setUser(null); }
    };
    window.addEventListener("auth-changed", syncUser);
    const token = localStorage.getItem("accessToken");
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
      axios.get("/api/auth/me")
        .then((response) => {
          const currentUser = response.data.data as StoredUser;
          localStorage.setItem("user", JSON.stringify(currentUser));
          setUser(currentUser);
        })
        .catch(() => {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("user");
          delete axios.defaults.headers.common.Authorization;
          setUser(null);
        });
    }
    return () => window.removeEventListener("auth-changed", syncUser);
  }, []);
  const canAccess = (permission: string) => user?.permissions?.includes(permission) ?? false;
  const adminLinks = links.slice(4).filter((item) =>
    item.page === "catalog" ? canAccess("PITCH_WRITE") :
    item.page === "schedule" ? canAccess("BOOKING_WRITE") :
    item.page === "dashboard" ? canAccess("REPORT_READ") : false
  );
  const adminUserLinks = links.slice(7).filter((item) =>
    item.page === "users" ? canAccess("USER_WRITE") :
    item.page === "audit" ? canAccess("AUDIT_READ") : false
  );
  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    delete axios.defaults.headers.common.Authorization;
    setUser(null);
    window.dispatchEvent(new Event("auth-changed"));
    setNotice("Bạn đã đăng xuất.");
    navigate("home");
  };
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
          {(adminLinks.length > 0 || adminUserLinks.length > 0) && <div className="nav-caption">QUẢN TRỊ</div>}
          {[...adminLinks,...adminUserLinks].map((item) => (
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
            {user ? (
              <>
                <span className="top-link">{user.fullName}</span>
                <button className="top-link" onClick={logout}>Đăng xuất</button>
              </>
            ) : (
              <button className="top-link" onClick={() => navigate("login")}>Đăng nhập</button>
            )}
            <button className="avatar" aria-label="Tài khoản" onClick={() => navigate(user ? "home" : "register")}>
              {user?.fullName?.charAt(0).toUpperCase() || "S"}
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
