import { useApp } from "../lib/AppContext";
import PageHead from "../components/PageHead";
import DemoBanner from "../components/DemoBanner";
import { demoPitches } from "../mocks/demoData";
import { money } from "../lib/format";

export default function BookingPage() {
  const {
    pitchId,
    setPitchId,
    date,
    setDate,
    selection,
    setSelection,
    services,
    toggleService,
    selectedPitch,
    serviceTotal,
    navigate,
  } = useApp();
  return (
    <>
      <PageHead
        tag="ĐẶT SÂN & DỊCH VỤ"
        title="Hoàn tất lựa chọn"
        subtitle="Bố cục minh họa, chưa tạo đơn đặt sân hoặc khóa khung giờ."
      />
      <DemoBanner>
        Giao diện mẫu: nút tiếp tục chỉ mở màn hình thanh toán minh họa. Chưa có
        API đặt sân.
      </DemoBanner>
      <div className="two-columns">
        <div className="stack">
          <section className="panel">
            <h2>01 · Thông tin trận đấu</h2>
            <div className="form-grid">
              <label>
                Sân bóng
                <select
                  value={pitchId}
                  onChange={(e) => {
                    setPitchId(Number(e.target.value));
                    setSelection(null);
                  }}
                >
                  {demoPitches.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.type} người
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ngày đá
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSelection(null);
                  }}
                />
              </label>
              <label>
                Khung giờ
                <select
                  value={selection?.slotId ?? ""}
                  onChange={(e) =>
                    setSelection(
                      e.target.value
                        ? { pitchId, date, slotId: Number(e.target.value) }
                        : null,
                    )
                  }
                >
                  <option value="">Chọn ca trong trang chi tiết sân</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Ca {n} · minh họa
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Số điện thoại
                <input
                  placeholder="Nhập số điện thoại (không gửi đi)"
                  inputMode="tel"
                />
              </label>
            </div>
            <button className="text-button" onClick={() => navigate("search")}>
              Xem lịch trống thật →
            </button>
          </section>
          <section className="panel">
            <h2>02 · Dịch vụ đi kèm</h2>
            <p className="muted">Giá chỉ để minh họa giao diện.</p>
            <div className="service-grid">
              {["Nước uống", "Áo tập", "Thuê bóng"].map((s) => (
                <label className="service" key={s}>
                  <input
                    type="checkbox"
                    checked={services.includes(s)}
                    onChange={() => toggleService(s)}
                  />
                  <span>
                    <b>{s}</b>
                    <small>50.000 đ</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
        <section className="panel order-card">
          <h2>Tóm tắt lựa chọn</h2>
          <div className="order-field">
            <span>Sân</span>
            <b>{selectedPitch.name}</b>
          </div>
          <div className="order-field">
            <span>Ngày</span>
            <b>{date || "Chưa chọn"}</b>
          </div>
          <div className="order-field">
            <span>Mã ca</span>
            <b>{selection?.slotId ?? "Chưa chọn"}</b>
          </div>
          <div className="order-field">
            <span>Giá sân tham khảo</span>
            <b>{money(selectedPitch.startingPrice)}</b>
          </div>
          <div className="order-field">
            <span>Dịch vụ minh họa</span>
            <b>{money(serviceTotal)}</b>
          </div>
          <div className="order-total">
            <span>Tổng tham khảo</span>
            <strong>{money(selectedPitch.startingPrice + serviceTotal)}</strong>
          </div>
          <button className="primary full" onClick={() => navigate("payment")}>
            Xem giao diện thanh toán →
          </button>
          <small>Giá thực tế phụ thuộc ca đá và loại ngày.</small>
        </section>
      </div>
    </>
  );
}
