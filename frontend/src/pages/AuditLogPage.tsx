import { useEffect, useState, type FormEvent } from 'react';
import PageHead from '../components/PageHead';
import { listAudit, type AuditEntry } from '../features/admin/api';

export default function AuditLogPage() {
  const [filters,setFilters] = useState({ actorId:'',action:'',entityType:'',from:'',to:'' });
  const [logs,setLogs] = useState<AuditEntry[]>([]);
  const [error,setError] = useState('');
  async function load() {
    try { setLogs(await listAudit(filters)); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được nhật ký.'); }
  }
  useEffect(() => { void listAudit({}).then(setLogs).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Không tải được nhật ký.')); }, []);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void load(); }
  return <>
    <PageHead tag="QUẢN TRỊ · UC2.6" title="Nhật ký thao tác" subtitle="Tra cứu thay đổi theo người thực hiện, hành động, đối tượng và thời gian." />
    <form className="panel admin-filter" onSubmit={submit}>
      <label>Mã người thực hiện <input type="number" min="1" value={filters.actorId} onChange={(e) => setFilters({...filters,actorId:e.target.value})} /></label>
      <label>Hành động <input placeholder="USER_CREATE" value={filters.action} onChange={(e) => setFilters({...filters,action:e.target.value})} /></label>
      <label>Đối tượng <input placeholder="USER" value={filters.entityType} onChange={(e) => setFilters({...filters,entityType:e.target.value})} /></label>
      <label>Từ ngày <input type="date" value={filters.from} onChange={(e) => setFilters({...filters,from:e.target.value})} /></label>
      <label>Đến ngày <input type="date" value={filters.to} onChange={(e) => setFilters({...filters,to:e.target.value})} /></label>
      <button className="primary">Lọc</button>
    </form>
    {error && <p className="demo-banner" role="alert">{error}</p>}
    <section className="panel"><h2>Nhật ký gần đây</h2>
      <div className="table-wrap"><table className="admin-table"><thead><tr>
        <th>Thời gian (UTC)</th><th>Người thực hiện</th><th>Hành động</th><th>Đối tượng</th><th>Trước / Sau</th>
      </tr></thead><tbody>
        {logs.map((log) => <tr key={log.id}>
          <td>{log.createdAt}</td><td>{log.actorName ?? `#${log.actorId ?? '—'}`}</td><td>{log.action}</td>
          <td>{log.entityType} #{log.entityId}</td>
          <td><details><summary>Xem thay đổi</summary><pre>{JSON.stringify({before:log.beforeData,after:log.afterData},null,2)}</pre></details></td>
        </tr>)}
        {logs.length === 0 && <tr><td colSpan={5}>Chưa có nhật ký phù hợp.</td></tr>}
      </tbody></table></div>
    </section>
  </>;
}
