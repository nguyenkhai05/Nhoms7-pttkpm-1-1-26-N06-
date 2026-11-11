import { useEffect, useState } from 'react';
import PageHead from '../components/PageHead';
import Metric from '../components/Metric';
import { downloadReport, getReport, type Report } from '../features/admin/api';
import { money } from '../lib/format';

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0,10);
function startOf(period: 'day' | 'week' | 'month', end: string) {
  const date = new Date(`${end}T00:00:00Z`);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - 6);
  if (period === 'month') date.setUTCDate(1);
  return date.toISOString().slice(0,10);
}

export default function DashboardPage() {
  const [to,setTo] = useState(today);
  const [period,setPeriod] = useState<'day'|'week'|'month'>('week');
  const from = startOf(period,to || today());
  const [report,setReport] = useState<Report | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    getReport(from,to).then((data) => { if (active) { setReport(data); setError(''); } })
      .catch((cause: unknown) => { if (active) { setReport(null); setError(cause instanceof Error ? cause.message : 'Không tải được báo cáo.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from,to]);
  async function exportCsv() {
    try { await downloadReport(from,to); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xuất được báo cáo.'); }
  }
  const max = Math.max(1,...(report?.daily.map((row) => Math.max(0,row.net)) ?? []));
  return <>
    <PageHead tag="QUẢN TRỊ · UC2.1" title="Báo cáo tổng quan" subtitle="Thống kê theo dữ liệu Booking, thanh toán và hoàn tiền." />
    <section className="panel admin-filter">
      <label>Khoảng xem <select value={period} onChange={(e) => { setLoading(true); setPeriod(e.target.value as typeof period); }}>
        <option value="day">Ngày</option><option value="week">7 ngày</option><option value="month">Tháng</option>
      </select></label>
      <label>Đến ngày <input type="date" value={to} onChange={(e) => { setLoading(true); setTo(e.target.value); }} /></label>
      <button className="outline" disabled={!report} onClick={() => void exportCsv()}>Xuất CSV</button>
    </section>
    {loading && <p role="status">Đang tải báo cáo…</p>}
    {error && <p className="demo-banner" role="alert">{error}</p>}
    {report && <>
      <p className="muted">Dữ liệu từ {report.from} đến {report.to}. Thực thu = tiền đã thanh toán thành công − tiền hoàn đã chi.</p>
      <div className="metric-grid">
        <Metric name="Thực thu" value={money(report.netCollected)} icon="₫" />
        <Metric name="Booking đã xác nhận" value={String(report.confirmedBookings)} icon="▣" />
        <Metric name="Tỷ lệ lấp đầy" value={`${report.occupancyPercent}%`} icon="◕" />
        <Metric name="Đơn chờ cọc" value={String(report.pendingBookings)} icon="◷" />
      </div>
      <div className="two-columns">
        <section className="panel"><h2>Tiền thu và hoàn</h2>
          <div className="order-field"><span>Thu từ sân</span><b>{money(report.pitchCollected)}</b></div>
          <div className="order-field"><span>Thu từ dịch vụ</span><b>{money(report.serviceCollected)}</b></div>
          <div className="order-field"><span>Đã hoàn</span><b>{money(report.refunded)}</b></div>
          <div className="order-total"><span>Thực thu</span><strong>{money(report.netCollected)}</strong></div>
          <small>Tiền cọc của đơn gồm sân và dịch vụ được phân bổ theo tỷ lệ giá trị từng phần.</small>
        </section>
        <section className="panel"><h2>Thực thu theo ngày</h2>
          <div className="chart-bars admin-chart" role="img" aria-label="Biểu đồ thực thu theo ngày">
            {report.daily.map((row) => <div key={row.date} title={`${row.date}: ${money(row.net)}`}>
              <span style={{ height: `${Math.max(2,Math.max(0,row.net)/max*100)}%` }} />
              <small>{row.date.slice(5)}</small>
            </div>)}
          </div>
          <p className="muted">Ca đã xác nhận: {report.filledSlots}/{report.availableSlots} ca có thể khai thác.</p>
        </section>
      </div>
    </>}
  </>;
}
