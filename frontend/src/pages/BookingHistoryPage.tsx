import { useEffect, useState } from 'react';
import PageHead from '../components/PageHead';
import { money } from '../lib/format';

export default function BookingHistoryPage() {

  const [customerId] = useState(1);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/payments/my-bookings?customerId=${customerId}`);
      const data = await res.json();
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Lỗi tải lịch sử:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [customerId]);

  const handleCancel = async (bookingId: number) => {
    const reason = prompt('Nhập lý do hủy sân (Nếu sân đã cọc, hệ thống sẽ tự động hoàn tiền):');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/payments/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, userId: customerId }),
      });

      if (res.ok) {
        alert('Đã hủy sân thành công!');
        loadHistory();
      } else {
        const err = await res.json();
        alert(err.message || 'Không thể hủy sân lúc này');
      }
    } catch (error) {
      alert('Lỗi kết nối máy chủ');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_DEPOSIT': return <span className="badge amber">Chờ đặt cọc</span>;
      case 'DEPOSIT_PAID': return <span className="badge green">Đã đặt cọc</span>;
      case 'COMPLETED': return <span className="badge">Đã đá</span>;
      case 'CANCELLED': return <span className="badge red">Đã hủy</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  return (
    <>
      <PageHead
        tag="KHÁCH HÀNG"
        title="Lịch sử đặt sân"
        subtitle="Xem lại các sân bạn đã đặt, trạng thái thanh toán và yêu cầu hủy sân."
      />

      <section className="panel">
        {isLoading ? (
          <p className="muted">Đang tải dữ liệu lịch sử...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee' }}>
                  <th style={{ padding: '12px 8px' }}>Mã đơn</th>
                  <th style={{ padding: '12px 8px' }}>Tên sân</th>
                  <th style={{ padding: '12px 8px' }}>Thời gian</th>
                  <th style={{ padding: '12px 8px' }}>Tổng tiền</th>
                  <th style={{ padding: '12px 8px' }}>Đã cọc</th>
                  <th style={{ padding: '12px 8px' }}>Trạng thái</th>
                  <th style={{ padding: '12px 8px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 8px' }}><b>{b.code}</b></td>
                    <td style={{ padding: '12px 8px' }}>{b.pitchName}</td>
                    <td style={{ padding: '12px 8px' }}>
                      <div>{new Date(b.date).toLocaleDateString('vi-VN')}</div>
                      <small className="muted">{b.start} - {b.end}</small>
                    </td>
                    <td style={{ padding: '12px 8px' }}>{money(b.totalAmount)}</td>
                    <td style={{ padding: '12px 8px' }}>{money(b.depositDue)}</td>
                    <td style={{ padding: '12px 8px' }}>{getStatusBadge(b.status)}</td>
                    <td style={{ padding: '12px 8px' }}>
                      {(b.status === 'PENDING_DEPOSIT' || b.status === 'DEPOSIT_PAID') && (
                        <button
                          className="outline"
                          onClick={() => handleCancel(b.id)}
                          style={{ padding: '4px 8px', fontSize: '13px' }}
                        >
                          Hủy sân
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }} className="muted">
                      Bạn chưa có lịch sử đặt sân nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}