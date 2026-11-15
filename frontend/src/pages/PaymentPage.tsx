import { useEffect, useState } from 'react';
import { useApp } from '../lib/AppContext';
import PageHead from '../components/PageHead';
import { money } from '../lib/format';
import { cancelBookingHold } from '../features/bookings/api';

function getRemainingSeconds(expiresAt: string | null) {
  if (!expiresAt) return 0;
  const normalized = expiresAt.includes('T') ? expiresAt : expiresAt.replace(' ', 'T');
  const iso = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

export default function PaymentPage() {
  const { booking, setBooking, navigate } = useApp();
  const [remaining, setRemaining] = useState(() => getRemainingSeconds(booking?.expiresAt ?? null));
  const [canceling, setCanceling] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState<any>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!booking?.id || booking.status !== 'PENDING_DEPOSIT') return;
    const token = localStorage.getItem('accessToken');
    fetch(`/api/payments/bookings/${booking.id}/qr`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async response => { const json = await response.json(); if (!response.ok) throw new Error(json.message || 'Không lấy được mã QR.'); setQr(json.data); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Không lấy được mã QR.'));
  }, [booking?.id, booking?.status]);

  async function simulatePayment() {
    if (!booking) return; setPaying(true); setError('');
    try { const token=localStorage.getItem('accessToken'); const response=await fetch(`/api/payments/bookings/${booking.id}/demo-paid`,{method:'POST',headers:token?{Authorization:`Bearer ${token}`}:{}}); const json=await response.json(); if(!response.ok) throw new Error(json.message||'Thanh toán thất bại.'); setBooking({...booking,status:'DEPOSIT_PAID',expiresAt:null}); setError('Đã xác nhận thanh toán demo. Đơn đã chuyển sang trạng thái ĐÃ CỌC.'); }
    catch(cause){setError(cause instanceof Error?cause.message:'Không thể thanh toán.');} finally{setPaying(false);}
  }

  useEffect(() => {
    if (!booking?.expiresAt) return;
    const update = () => setRemaining(getRemainingSeconds(booking.expiresAt));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [booking?.expiresAt]);

  async function cancelHold() {
    if (!booking) return;
    setCanceling(true);
    setError('');
    try {
      await cancelBookingHold(booking.id);
      setBooking(null);
      navigate('search');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể hủy giữ chỗ.');
    } finally {
      setCanceling(false);
    }
  }

  if (!booking) {
    return (
      <>
        <PageHead tag="THANH TOÁN TIỀN CỌC" title="Chưa có Booking" subtitle="Bạn cần tạo đơn đặt sân trước khi thanh toán." />
        <section className="panel">
          <p>Không tìm thấy Booking đang được giữ trong phiên hiện tại.</p>
          <button className="primary" onClick={() => navigate('search')}>Quay lại tìm sân</button>
        </section>
      </>
    );
  }

  const expired = remaining <= 0 || booking.status !== 'PENDING_DEPOSIT';
  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return (
    <>
      <PageHead
        tag="BOOKING ĐÃ ĐƯỢC TẠO"
        title="Giữ chỗ thành công"
        subtitle="Slot đang được giữ tạm thời trong 15 phút để chờ thanh toán cọc."
      />
      {error && <div className="demo-banner" role="alert">{error}</div>}
      <div className="two-columns payment-layout">
        <section className="panel">
          <h2>Thông tin Booking</h2>
          <div className="steps">
            <span className="done">1 · Chọn sân</span>
            <span className="done">2 · Giữ slot</span>
            <span>3 · Thanh toán cọc</span>
          </div>
          <div className="order-field"><span>Mã Booking</span><b>{booking.code}</b></div>
          <div className="order-field"><span>Sân bóng</span><b>{booking.pitchName}</b></div>
          <div className="order-field"><span>Ngày thi đấu</span><b>{booking.date}</b></div>
          <div className="order-field"><span>Khung giờ</span><b>{booking.slotStart} – {booking.slotEnd}</b></div>
          <div className="order-field"><span>Tiền sân</span><b>{money(booking.pitchAmount)}</b></div>
          <div className="order-field"><span>Dịch vụ</span><b>{money(booking.serviceAmount)}</b></div>
          <div className="order-field"><span>Tổng giá trị</span><b>{money(booking.totalAmount)}</b></div>
          <div className="order-total"><span>Tiền cọc cần thanh toán</span><strong>{money(booking.depositDue)}</strong></div>
          <div className="order-field">
            <span>Thời gian còn lại</span>
            <b className={expired ? 'badge red' : 'badge amber'}>
              {expired ? 'Đã hết hạn / không còn giữ chỗ' : `${minutes}:${seconds}`}
            </b>
          </div>
          {!expired ? (
            <button className="outline" disabled={canceling} onClick={() => void cancelHold()}>
              {canceling ? 'Đang hủy…' : 'Hủy giữ chỗ'}
            </button>
          ) : (
            <button className="primary" onClick={() => { setBooking(null); navigate('search'); }}>
              Tìm khung giờ khác
            </button>
          )}
        </section>

        <section className="panel qr-panel">
          {qr ? <div className="qr-placeholder"><img src={qr.qrImageUrl} alt="Mã VietQR demo" style={{width:'min(100%,280px)',height:'auto',margin:'0 auto'}}/><b>Thanh toán VietQR · Tài khoản mẫu</b><small>Ngân hàng: {qr.bankCode} · STK: {qr.accountNumber}</small><small>Chủ TK: {qr.accountName}</small><small>Nội dung: {qr.description}</small><b>{money(qr.amount)}</b></div> : <div className="qr-placeholder"><div className="qr-squares" aria-hidden="true">▦</div><b>Thanh toán VietQR</b><small>{booking.status==='PENDING_DEPOSIT'?'Đang tạo mã QR...':'Thanh toán đã được ghi nhận.'}</small></div>}
          <p>Trạng thái Booking: <span className="badge amber">{booking.status}</span></p>
          {booking.status==='PENDING_DEPOSIT' && <button className="primary" disabled={paying||expired} onClick={()=>void simulatePayment()}>{paying?'Đang xác nhận...':'Mô phỏng đã chuyển khoản'}</button>}
          {booking.status==='DEPOSIT_PAID' && <p className="success-text">Đã thanh toán cọc thành công. Lễ tân có thể tìm đơn trên ma trận lịch để check-in.</p>}
          {expired && <p className="muted">Tiến trình backend sẽ tự đánh dấu đơn hết hạn và giải phóng slot, tồn kho dịch vụ đã giữ.</p>}
        </section>
      </div>
    </>
  );
}
