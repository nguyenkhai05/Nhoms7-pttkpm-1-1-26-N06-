import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/AppContext';
import PageHead from '../components/PageHead';
import { money } from '../lib/format';
import {
  createBookingHold,
  getBookingServices,
  type BookingService,
} from '../features/bookings/api';

export default function BookingPage() {
  const { selection, selectedPitch, setBooking, navigate } = useApp();
  const [availableServices, setAvailableServices] = useState<BookingService[]>([]);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [loadingServices, setLoadingServices] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!selection) return;
    let active = true;
    setLoadingServices(true);
    setError('');
    getBookingServices(selection.pitchId)
      .then((items) => {
        if (active) setAvailableServices(items);
      })
      .catch((cause: unknown) => {
        if (active) {
          setAvailableServices([]);
          setError(cause instanceof Error ? cause.message : 'Không tải được danh sách dịch vụ.');
        }
      })
      .finally(() => {
        if (active) setLoadingServices(false);
      });
    return () => {
      active = false;
    };
  }, [selection]);

  const selectedServices = useMemo(
    () => availableServices
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({ serviceId: item.id, quantity: quantities[item.id] ?? 0 })),
    [availableServices, quantities],
  );

  const serviceTotal = useMemo(
    () => availableServices.reduce(
      (total, item) => total + item.price * (quantities[item.id] ?? 0),
      0,
    ),
    [availableServices, quantities],
  );

  async function submitBooking() {
    if (!selection) {
      setError('Bạn cần chọn một khung giờ từ trang lịch sân trước.');
      return;
    }
    if (!localStorage.getItem('accessToken')) {
      setError('Bạn cần đăng nhập bằng tài khoản khách hàng trước khi đặt sân.');
      navigate('login');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const booking = await createBookingHold({
        pitchId: selection.pitchId,
        slotId: selection.slotId,
        date: selection.date,
        services: selectedServices,
      });
      setBooking(booking);
      navigate('payment');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể giữ khung giờ.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!selection) {
    return (
      <>
        <PageHead
          tag="ĐẶT SÂN & DỊCH VỤ"
          title="Bạn chưa chọn khung giờ"
          subtitle="Hãy chọn một slot màu xanh trên lịch sân trước khi tạo Booking."
        />
        <section className="panel">
          <p>Hệ thống chưa nhận được lựa chọn sân và khung giờ.</p>
          <button className="primary" onClick={() => navigate('search')}>Tìm sân và xem lịch trống</button>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        tag="ĐẶT SÂN & DỊCH VỤ"
        title="Xác nhận thông tin đặt sân"
        subtitle="Hệ thống chỉ giữ slot khi bạn xác nhận. Thời gian giữ chỗ là 15 phút."
      />
      {error && <div className="demo-banner" role="alert">{error}</div>}
      <div className="two-columns">
        <div className="stack">
          <section className="panel">
            <h2>01 · Thông tin trận đấu</h2>
            <div className="order-field"><span>Sân bóng</span><b>{selectedPitch.name}</b></div>
            <div className="order-field"><span>Cụm sân</span><b>{selectedPitch.complexName}</b></div>
            <div className="order-field"><span>Địa chỉ</span><b>{selectedPitch.address}</b></div>
            <div className="order-field"><span>Ngày đá</span><b>{selection.date}</b></div>
            <div className="order-field">
              <span>Khung giờ</span>
              <b>{selection.start && selection.end ? `${selection.start} – ${selection.end}` : `Mã slot ${selection.slotId}`}</b>
            </div>
            <button className="text-button" onClick={() => navigate('detail', selection.pitchId)}>
              ← Chọn lại khung giờ
            </button>
          </section>

          <section className="panel">
            <h2>02 · Dịch vụ đi kèm</h2>
            <p className="muted">Giá và tồn kho được lấy từ database. Số lượng sẽ được giữ cùng giao dịch đặt sân.</p>
            {loadingServices && <p>Đang tải dịch vụ…</p>}
            {!loadingServices && availableServices.length === 0 && (
              <p className="muted">Cụm sân chưa có dịch vụ khả dụng. Bạn vẫn có thể đặt sân mà không chọn dịch vụ.</p>
            )}
            <div className="service-grid">
              {availableServices.map((item) => {
                const quantity = quantities[item.id] ?? 0;
                const soldOut = item.availableQuantity <= 0;
                return (
                  <label className="service" key={item.id}>
                    <span>
                      <b>{item.name}</b>
                      <small>{money(item.price)} / {item.unit}</small>
                      <small>Còn khả dụng: {item.availableQuantity}</small>
                    </span>
                    <input
                      aria-label={`Số lượng ${item.name}`}
                      type="number"
                      min={0}
                      max={Math.min(item.availableQuantity, 100)}
                      value={quantity}
                      disabled={soldOut}
                      onChange={(event) => {
                        const next = Math.max(0, Math.min(item.availableQuantity, 100, Math.floor(Number(event.target.value) || 0)));
                        setQuantities((current) => ({ ...current, [item.id]: next }));
                      }}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <section className="panel order-card">
          <h2>03 · Tóm tắt đơn</h2>
          <div className="order-field"><span>Sân</span><b>{selectedPitch.name}</b></div>
          <div className="order-field"><span>Ngày</span><b>{selection.date}</b></div>
          <div className="order-field">
            <span>Khung giờ</span>
            <b>{selection.start && selection.end ? `${selection.start} – ${selection.end}` : `#${selection.slotId}`}</b>
          </div>
          <div className="order-field">
            <span>Tiền sân</span>
            <b>{selection.price == null ? 'Sẽ được kiểm tra lại' : money(selection.price)}</b>
          </div>
          <div className="order-field"><span>Dịch vụ</span><b>{money(serviceTotal)}</b></div>
          <div className="order-total">
            <span>Tạm tính</span>
            <strong>{selection.price == null ? '—' : money(selection.price + serviceTotal)}</strong>
          </div>
          <p className="muted">Tiền cọc được backend tính theo tỷ lệ cấu hình trong bảng giá, không lấy số tiền do trình duyệt tự gửi.</p>
          <button className="primary full" disabled={submitting || loadingServices || selection.price == null} onClick={() => void submitBooking()}>
            {submitting ? 'Đang giữ slot…' : 'Xác nhận đặt sân & giữ slot 15 phút'}
          </button>
          <small>MySQL sẽ kiểm tra lại slot và tồn kho trong transaction trước khi tạo Booking.</small>
        </section>
      </div>
    </>
  );
}
