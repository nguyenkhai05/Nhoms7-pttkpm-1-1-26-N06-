import { useEffect, useState } from 'react';
import PageHead from '../components/PageHead';
import DemoBanner from '../components/DemoBanner';
import Metric from '../components/Metric';
import { money } from '../lib/format';

export default function DashboardPage() {
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(iso(today));
  const [groupBy, setGroupBy] = useState('day');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      setError('');
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/reports/summary?from=${from}&to=${to}&groupBy=${groupBy}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || 'Không tải được báo cáo.');
      setData(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được báo cáo.');
    }
  }

  useEffect(() => { void load(); }, []);

  async function exportCsv() {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/reports/export?from=${from}&to=${to}&groupBy=${groupBy}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error('Không thể xuất báo cáo.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'SportSpace-report.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lỗi xuất báo cáo.');
    }
  }

  return <>
    <PageHead tag="QUẢN TRỊ · UC2.1" title="Báo cáo tổng quan" subtitle="KPI được tổng hợp từ thanh toán, hoàn cọc và Booking theo kỳ lọc." />
    <DemoBanner>Tiền sân và dịch vụ được phân bổ theo tỷ trọng của đơn từ các khoản đã thu. Khoản đã hoàn được trừ trong doanh thu ròng.</DemoBanner>
    <section className="panel">
      <div className="panel-head">
        <h2>Bộ lọc báo cáo</h2>
        <div className="date-label">
          Từ <input type="date" value={from} onChange={e => setFrom(e.target.value)} /> đến <input type="date" value={to} onChange={e => setTo(e.target.value)} />
          <select aria-label="Nhóm báo cáo" value={groupBy} onChange={e => setGroupBy(e.target.value)}><option value="day">Theo ngày</option><option value="week">Theo tuần</option><option value="month">Theo tháng</option><option value="year">Theo năm</option></select>
          <button className="primary" onClick={() => void load()}>Lọc</button>
          <button className="outline" onClick={() => void exportCsv()}>Xuất CSV / Excel</button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
    {data && <>
      <div className="metric-grid">
        <Metric name="Doanh thu ròng" value={money(Number(data.netRevenue))} icon="₫" />
        <Metric name="Tổng đơn hợp lệ" value={String(data.totalBookings)} icon="▣" />
        <Metric name="Tỷ lệ lấp đầy" value={`${data.fillingRate}%`} icon="◕" />
        <Metric name="Đơn chờ cọc" value={String(data.pendingBookings)} icon="◷" />
        <Metric name="Thu từ sân" value={money(Number(data.pitchRevenue))} icon="₫" />
        <Metric name="Thu từ dịch vụ" value={money(Number(data.serviceRevenue))} icon="₫" />
      </div>
      <div className="two-columns">
        <section className="panel">
          <h2>Thu tiền theo {groupBy === 'day' ? 'ngày' : groupBy === 'week' ? 'tuần' : groupBy === 'month' ? 'tháng' : 'năm'}</h2>
          {data.series?.length ? data.series.map((item: any) => <div className="activity" key={item.bucket}><b>{String(item.bucket).slice(0, 10)}</b><span>{money(Number(item.grossRevenue))}</span><small>{item.payments} giao dịch</small></div>) : <p>Chưa có giao dịch trong khoảng này.</p>}
        </section>
        <section className="panel">
          <h2>Đơn theo trạng thái</h2>
          {data.byStatus?.map((item: any) => <div className="activity" key={item.status}><b>{item.status}</b><span>{item.total}</span></div>)}
          <p className="muted">{data.notes}</p>
        </section>
      </div>
    </>}
  </>;
}
