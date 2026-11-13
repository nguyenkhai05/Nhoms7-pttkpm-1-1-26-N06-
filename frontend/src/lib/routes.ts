export type Page =
  | "home"
  | "search"
  | "detail"
  | "booking"
  | "payment"
  | "catalog"
  | "schedule"
  | "dashboard"
  | "login"
  | "register";

export const titles: Record<Page, string> = {
  home: "Trang chủ",
  search: "Tìm sân",
  detail: "Chi tiết sân",
  booking: "Đặt sân",
  payment: "Thanh toán cọc",
  catalog: "Danh mục sân & bảng giá",
  schedule: "Ma trận lịch sân",
  dashboard: "Báo cáo tổng quan",
  login: "Đăng nhập",
  register: "Đăng ký",
};

export const links: { page: Page; label: string; icon: string }[] = [
  { page: "home", label: "Trang chủ", icon: "⌂" },
  { page: "search", label: "Tìm sân & lịch trống", icon: "⚽" },
  { page: "booking", label: "Đặt sân & dịch vụ", icon: "▣" },
  { page: "payment", label: "Thanh toán VietQR", icon: "▤" },
  { page: "catalog", label: "Danh mục & bảng giá", icon: "▦" },
  { page: "schedule", label: "Ma trận lịch sân", icon: "▦" },
  { page: "dashboard", label: "Báo cáo tổng quan", icon: "◫" },
];

export function currentPage(): Page {
  const hash = location.hash.replace(/^#\/?/, "").split("?")[0] as Page;
  return hash in titles ? hash : "home";
}
export function currentPitchId(): number {
  const value = Number(
    new URLSearchParams(location.hash.split("?")[1] ?? "").get("id"),
  );
  return Number.isSafeInteger(value) && value > 0 ? value : 1;
}
