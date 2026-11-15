import { useEffect, useState } from 'react';
import PageHead from '../components/PageHead';
import DemoBanner from '../components/DemoBanner';

export default function AuditPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/audit-logs?page=${page}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || 'Không tải được audit log');
        if (active) { setRows(json.data || []); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Không tải được audit log.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [page]);

  return <>
    <PageHead tag="QUẢN TRỊ · UC2.6" title="Audit Log" subtitle="Nhật ký thao tác quản trị, thanh toán, bảng giá, kho và vận hành sân." />
    <DemoBanner>Nhật ký hiển thị theo trang, 50 sự kiện gần nhất trước. Các thao tác nghiệp vụ được nối sẽ lưu người thực hiện, thời gian, đối tượng và dữ liệu sau thay đổi.</DemoBanner>
    <section className="panel">
      <div className="panel-head"><h2>Hoạt động gần đây</h2><span className="muted">Trang {page}</span></div>
      {error && <p role="alert">{error}</p>}
      {loading && <p className="muted">Đang tải…</p>}
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
      <div className="action-row" style={{justifyContent:'flex-end',marginTop:16}}>
        <button className="outline" disabled={page===1||loading} onClick={()=>setPage(value=>Math.max(1,value-1))}>Trang trước</button>
        <button className="outline" disabled={rows.length<50||loading} onClick={()=>setPage(value=>value+1)}>Trang sau</button>
      </div>
    </section>
  </>;
}
