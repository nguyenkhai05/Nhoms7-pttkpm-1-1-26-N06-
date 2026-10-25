import { useApp } from "../lib/AppContext";
import type { Page } from "../lib/routes";

export default function HomePage() {
  const { navigate } = useApp();
  return (
    <>
      <div className="hero">
        <div className="hero-copy">
          <span className="eyebrow">CHÀO MỪNG ĐẾN SPORTSPACE</span>
          <h1>
            Tìm sân nhanh.
            <br />
            <em>Ra sân đúng giờ.</em>
          </h1>
          <p>
            Tìm sân phù hợp, xem lịch trống và khám phá một luồng đặt sân trực
            quan cho nhóm của bạn.
          </p>
          <div className="hero-actions">
            <button className="primary" onClick={() => navigate("search")}>
              Khám phá sân bóng <span>↗</span>
            </button>
            <button className="ghost" onClick={() => navigate("schedule")}>
              Xem ma trận lịch
            </button>
          </div>
          <div className="hero-stats">
            <span>
              <b>05 · 07 · 11</b>
              <small>Quy cách sân</small>
            </span>
            <span>
              <b>03 trạng thái</b>
              <small>Lịch theo thời gian thực</small>
            </span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="field">
            <span className="field-center" />
            <span className="field-goal left" />
            <span className="field-goal right" />
          </div>
          <div className="floating-label">● Sẵn sàng ra sân</div>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <span className="eyebrow">GIAO DIỆN MẪU</span>
          <h2>Các bước trong trải nghiệm</h2>
        </div>
      </div>
      <div className="feature-grid">
        {[
          {
            n: "01",
            title: "Tìm sân phù hợp",
            desc: "Lọc theo loại sân, khu vực, giá và tiện ích.",
            p: "search" as Page,
          },
          {
            n: "02",
            title: "Xem lịch trực quan",
            desc: "Xanh trống, vàng đang giữ, đỏ đã cọc.",
            p: "schedule" as Page,
          },
          {
            n: "03",
            title: "Chọn dịch vụ",
            desc: "Xem bố cục đơn đặt sân và dịch vụ đi kèm.",
            p: "booking" as Page,
          },
        ].map((f) => (
          <button className="feature" key={f.n} onClick={() => navigate(f.p)}>
            <span>{f.n}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <b>Khám phá ↗</b>
          </button>
        ))}
      </div>
    </>
  );
}
