import type { Pitch, Selection } from '../types';
import { useEffect, useState } from 'react';
import { api } from '../api';
import TimeSlotMatrixGrid from './TimeSlotMatrixGrid';

export default function PitchDetailPage({ id, onBack, onSelect }: { id: number; onBack: () => void; onSelect: (selection: Selection) => void }) {
  const [pitch, setPitch] = useState<Pitch | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setPitch(null); setError('');
    api<Pitch>('/' + id, controller.signal).then(setPitch).catch(cause => {
      if (cause.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Không thể tải chi tiết sân.');
    });
    return () => controller.abort();
  }, [id]);
  return <div className="detail-view"><button className="detail-back" onClick={onBack}>← Danh sách sân</button>{error && <div className="demo-banner" role="alert">Không tải được chi tiết sân: {error}. Kiểm tra backend và MySQL rồi thử lại.</div>}{pitch ? <><section className="panel"><h1 className="detail-title">{pitch.name}</h1><p className="muted">{pitch.complexName} · {pitch.address} · Sân {pitch.type} người</p>{pitch.image ? <img className="detail-visual" src={pitch.image} alt={pitch.name}/> : <div className="detail-visual">⚽ SÂN {pitch.type}</div>}<p><b>Mặt cỏ:</b> {pitch.grass || 'Chưa cập nhật'} &nbsp; · &nbsp; <b>Chiếu sáng:</b> {pitch.lights || 'Chưa cập nhật'}</p><div className="amenities">{pitch.amenities.map(a => <span key={a.id}>{a.name}</span>)}</div></section><section className="panel"><h2>Bảng giá theo ca</h2><div className="table-wrap"><table><thead><tr><th>Loại ngày</th><th>Khung giờ</th><th>Giá / ca</th></tr></thead><tbody>{pitch.prices.map(rule => <tr key={rule.id}><td>{({ WEEKDAY: 'Ngày thường', WEEKEND: 'Cuối tuần', HOLIDAY: 'Ngày lễ' } as Record<string, string>)[rule.dayType] ?? rule.dayType}</td><td>{rule.start} – {rule.end}</td><td><b>{rule.amount.toLocaleString('vi-VN')} đ</b></td></tr>)}</tbody></table></div></section><section className="panel"><TimeSlotMatrixGrid pitchId={id} onSelect={onSelect}/></section></> : !error && <section className="panel">Đang tải thông tin sân…</section>}</div>;
}
