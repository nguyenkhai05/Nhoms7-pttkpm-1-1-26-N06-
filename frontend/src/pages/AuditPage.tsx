import { useEffect, useState } from 'react';
import PageHead from '../components/PageHead';

type Filters = { actorId: string; action: string; entityType: string; from: string; to: string };
const empty: Filters = { actorId: '', action: '', entityType: '', from: '', to: '' };
type AuditRow = { id: number; createdAt: string; actorName?: string; action: string; entityType: string; entityId?: string; beforeData?: unknown; afterData?: unknown };

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [draft, setDraft] = useState<Filters>(empty);
  const [filters, setFilters] = useState<Filters>(empty);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const params = new URLSearchParams({ page: String(page) });
        Object.entries(filters).forEach(([key, value]) => { if (value.trim()) params.set(key, value.trim()); });
        const response = await fetch(`/api/audit-logs?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || 'Không tải được audit log.');
        if (active) { setRows(json.data || []); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được audit log.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [page, filters]);

  function apply(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); setPage(1); setFilters({ ...draft }); }
  function clear() { setDraft(empty); setPage(1); setFilters(empty); }
  function update(key: keyof Filters, value: string) { setDraft(current => ({ ...current, [key]: value })); }

  return <>
    <PageHead tag="QUẢN TRỊ · UC2.6" title="Audit Log" subtitle="Tra cứu thay đổi theo người, hành động, đối tượng và thời gian." />
    <section className="panel">
      <h2>Bộ lọc nhật ký</h2>
      <form className="form-grid" onSubmit={apply}>
        <label>ID người thực hiện<input inputMode="numeric" value={draft.actorId} onChange={e => update('actorId', e.target.value)} /></label>
        <label>Hành động<input placeholder="VD: STAFF_UPDATED" value={draft.action} onChange={e => update('action', e.target.value)} /></label>
        <label>Loại đối tượng<input placeholder="VD: USER" value={draft.entityType} onChange={e => update('entityType', e.target.value)} /></label>
        <label>Từ ngày<input type="date" value={draft.from} onChange={e => update('from', e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={draft.to} onChange={e => update('to', e.target.value)} /></label>
        <button className="primary" type="submit">Lọc</button><button className="outline" type="button" onClick={clear}>Xóa lọc</button>
      </form>
    </section>
    <section className="panel">
      <div className="panel-head"><h2>Hoạt động gần đây</h2><span className="muted">Trang {page}</span></div>
      {error && <p role="alert" className="error-text">{error}</p>}
      {loading && <p>Đang tải…</p>}
      <div className="table-wrap"><table>
        <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
          <td>{row.actorName || 'Hệ thống'}</td>
          <td>{row.action}</td>
          <td>{row.entityType} #{row.entityId}</td>
          <td><details><summary>Xem</summary><pre>{JSON.stringify({ before: row.beforeData, after: row.afterData }, null, 2)}</pre></details></td>
        </tr>)}</tbody>
      </table></div>
      <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="outline" disabled={page === 1 || loading} onClick={() => setPage(value => Math.max(1, value - 1))}>Trang trước</button>
        <button className="outline" disabled={rows.length < 50 || loading} onClick={() => setPage(value => value + 1)}>Trang sau</button>
      </div>
    </section>
  </>;
}
