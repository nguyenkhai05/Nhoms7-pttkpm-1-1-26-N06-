import { useApp } from "../lib/AppContext";
import PageHead from "../components/PageHead";
import DemoBanner from "../components/DemoBanner";
import { money } from "../lib/format";

export default function PaymentPage() {
  const { selectedPitch, date, selection, navigate } = useApp();
  return (
    <>
      <PageHead
        tag="THANH TOÁN TIỀN CỌC"
        title="Thanh toán VietQR"
        subtitle="Màn hình minh họa bước thanh toán cho đơn đặt sân."
      />
      <DemoBanner>
        Chưa có giao dịch thực, tài khoản nhận tiền, mã VietQR và xác nhận thanh
        toán. Không chuyển khoản theo màn hình này.
      </DemoBanner>
      <div className="two-columns payment-layout">
        <section className="panel">
          <h2>Thông tin thanh toán</h2>
          <div className="steps">
            <span className="done">1 · Chọn sân</span>
            <span className="done">2 · Chọn ca</span>
            <span>3 · Thanh toán cọc</span>
          </div>
          <div className="order-field">
            <span>Sân bóng</span>
            <b>{selectedPitch.name}</b>
          </div>
          <div className="order-field">
            <span>Ngày thi đấu</span>
            <b>{date}</b>
          </div>
          <div className="order-field">
            <span>Khung giờ</span>
            <b>{selection ? `Mã ca ${selection.slotId}` : "Chưa chọn"}</b>
          </div>
          <div className="order-total">
            <span>Tiền cọc tham khảo</span>
            <strong>
              {money(Math.round(selectedPitch.startingPrice * 0.3))}
            </strong>
          </div>
          <button className="outline" onClick={() => navigate("booking")}>
            ← Quay lại lựa chọn
          </button>
        </section>
        <section className="panel qr-panel">
          <div className="qr-placeholder">
            <div className="qr-squares" aria-hidden="true">
              ▦
            </div>
            <b>Vùng hiển thị mã VietQR</b>
            <small>Chỉ xuất hiện sau khi backend tạo giao dịch hợp lệ</small>
          </div>
          <p>
            Trạng thái:{" "}
            <span className="badge amber">Chưa khởi tạo giao dịch</span>
          </p>
        </section>
      </div>
    </>
  );
}
