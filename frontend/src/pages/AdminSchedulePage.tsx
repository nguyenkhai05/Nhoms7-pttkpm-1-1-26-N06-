import { useEffect, useState } from 'react';
import { useApp } from '../lib/AppContext';
import PageHead from '../components/PageHead';
import DemoBanner from '../components/DemoBanner';

export default function AdminSchedulePage() {
  const { date, setDate, navigate } = useApp();
  const [data, setData] = useState<{ pitches: any[]; slots: any[]; bookings: any[] }>({
    pitches: [],
    slots: [],
    bookings: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadMatrix = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/matrix/data?date=${date}`);
      const json = await res.json();
      setData({
        pitches: json.pitches || [],
        slots: json.slots || [],
        bookings: json.bookings || [],
      });
    } catch (error) {
      console.error('Lỗi tải dữ liệu ma trận:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, [date]);

  // Xử lý tạo đơn vãng lai hoặc check-in khi click vào ô trên lưới
  const handleCellClick = async (pitch: any, slot: any) => {
    const booking = data.bookings.find((b: any) => b.pitchId === pitch.id && b.slotId === slot.id);

    if (!booking) {
      // Ô trống -> Tạo đơn vãng lai tại quầy
      const confirmWalkIn = window.confirm(`Tạo đơn đặt vãng lai cho sân ${pitch.name} lúc ${slot.start.slice(0, 5)} - ${slot.end.slice(0, 5)} ngày ${date}?`);
      if (!confirmWalkIn) return;

      try {
        const res = await fetch('/api/matrix/walk-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pitchId: pitch.id,
            slotId: slot.id,
            date,
            guestName: 'Khách vãng lai',
            guestPhone: '',
            totalAmount: pitch.price || 300000,
          }),
        });
        if (res.ok) {
          alert('Tạo đơn vãng lai thành công!');
          loadMatrix();
        } else {
          alert('Không thể tạo đơn.');
        }
      } catch (e) {
        alert('Lỗi kết nối server.');
      }
    } else if (booking.status === 'DEPOSIT_PAID') {
      // Đã cọc -> Check-in
      const confirmCheckIn = window.confirm(`Xác nhận Check-in cho đơn ${booking.code} (${booking.guestName || 'Khách'})?`);
      if (!confirmCheckIn) return;

      try {
        const res = await fetch(`/api/matrix/check-in/${booking.id}`, { method: 'POST' });
        if (res.ok) {
          alert('Check-in thành công!');
          loadMatrix();
        }
      } catch (e) {
        alert('Lỗi check-in.');
      }
    } else {
      alert(`Trạng thái ca này: ${booking.status}`);
    }
  };

  // Xác định màu sắc và nhãn của từng ô slot dựa trên dữ liệu thật từ Backend
  const renderSlotCell = (pitch: any, slot: any) => {
    const booking = data.bookings.find((b: any) => b.pitchId === pitch.id && b.slotId === slot.id);

    if (!booking) {
      return (
        <span className="slot-pill green" style={{ cursor: 'pointer' }} title="Click để đặt vãng lai">
          Trống
        </span>
      );
    }

    if (booking.status === 'PENDING_DEPOSIT') {
      return <span className="slot-pill yellow">Giữ tạm</span>;
    }

    if (booking.status === 'DEPOSIT_PAID') {
      return (
        <span className="slot-pill red" style={{ cursor: 'pointer' }} title="Click để Check-in">
          Đã cọc (Check-in)
        </span>
      );
    }

    return <span className="slot-pill red">Đã check-in</span>;
  };

  return (
    <>
      <PageHead
        tag="QUẢN TRỊ · HỆ THỐNG"
        title="Ma trận lịch sân"
        subtitle="Tổng quan các ca theo sân và ngày được chọn. Click vào ô trống để tạo đơn hoặc ô đã cọc để check-in."
      />
      <DemoBanner>
        Ma trận quản trị kết nối trực tiếp CSDL. Hỗ trợ đặt nhanh tại quầy và check-in thời gian thực cho UC2.2.
      </DemoBanner>
      <section className="panel">
        <div className="panel-head">
          <h2>Lịch theo ca</h2>
          <label className="date-label">
            Ngày{" "}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div className="legend">
          <span>
            <i className="dot green" /> Trống (Đặt vãng lai)
          </span>
          <span>
            <i className="dot yellow" /> Giữ tạm
          </span>
          <span>
            <i className="dot red" /> Đã cọc / Check-in
          </span>
        </div>
        <div className="table-wrap">
          {isLoading ? (
            <p style={{ padding: '20px', textAlign: 'center' }}>Đang tải ma trận lịch sân...</p>
          ) : (
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>Sân bóng</th>
                  {data.slots.map((s: any) => (
                    <th key={s.id}>
                      {s.start.slice(0, 5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.pitches.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.name}</b>
                      <small>{p.type} người</small>
                    </td>
                    {data.slots.map((s: any) => (
                      <td key={s.id} onClick={() => handleCellClick(p, s)}>
                        {renderSlotCell(p, s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <button className="text-button" onClick={() => navigate("search")}>
          Xem lịch từ API theo sân →
        </button>
      </section>
    </>
  );
}