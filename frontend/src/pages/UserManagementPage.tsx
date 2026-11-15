import { useCallback, useEffect, useState } from 'react';
import PageHead from '../components/PageHead';

type Staff = { id: number; fullName: string; email: string; phone: string | null; status: 'ACTIVE' | 'LOCKED'; roles: string[] };
const roleNames: Record<string, string> = { ADMIN: 'Admin', MANAGER: 'Quản lý', RECEPTIONIST: 'Lễ tân', ACCOUNTANT: 'Kế toán' };

async function api(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/admin/users${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message || 'Yêu cầu thất bại.');
  return body.data;
}

export default function UserManagementPage() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('RECEPTIONIST');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api(`?page=${page}&q=${encodeURIComponent(query)}`);
      setRows(result.items || []);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được nhân sự.'); }
    finally { setLoading(false); }
  }, [page, query]);
  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api('', { method: 'POST', body: JSON.stringify({ fullName, email, phone, password, roles: [role] }) });
      setFullName(''); setEmail(''); setPhone(''); setPassword(''); setMessage('Đã tạo tài khoản nhân sự.');
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được tài khoản.'); }
  }

  async function change(user: Staff, patch: object) {
    try {
      await api(`/${user.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      setMessage(`Đã cập nhật ${user.fullName}.`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được.'); }
  }

  return <>
    <PageHead tag="QUẢN TRỊ · UC2.6" title="Quản lý tài khoản nhân sự" subtitle="Tạo nhân viên, gán vai trò và khóa hoặc mở tài khoản." />
    {error && <p role="alert" className="error-text">{error}</p>}
    {message && <p role="status">{message}</p>}
    <section className="panel">
      <h2>Thêm nhân sự</h2>
      <form className="form-grid" onSubmit={e => void create(e)}>
        <label>Họ tên<input required minLength={2} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label>Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Số điện thoại<input value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <label>Mật khẩu ban đầu<input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Vai trò<select value={role} onChange={e => setRole(e.target.value)}>{Object.entries(roleNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
        <button className="primary" type="submit">Tạo tài khoản</button>
      </form>
    </section>
    <section className="panel">
      <div className="panel-head"><h2>Danh sách nhân sự</h2><form onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search.trim()); }} className="date-label"><input aria-label="Tìm nhân sự" placeholder="Họ tên hoặc email" value={search} onChange={e => setSearch(e.target.value)} /><button className="outline" type="submit">Tìm</button></form></div>
      {loading && <p>Đang tải…</p>}
      <div className="table-wrap"><table><thead><tr><th>Nhân sự</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{rows.map(user => <tr key={user.id}>
        <td>{user.fullName}<small>{user.phone || '—'}</small></td><td>{user.email}</td>
        <td><select aria-label={`Vai trò của ${user.fullName}`} value={user.roles[0] || ''} onChange={e => void change(user, { roles: [e.target.value] })}>{Object.entries(roleNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></td>
        <td>{user.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</td>
        <td><button className="outline" onClick={() => void change(user, { status: user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' })}>{user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button></td>
      </tr>)}</tbody></table></div>
      <div className="action-row" style={{ justifyContent: 'flex-end', marginTop: 16 }}><button className="outline" disabled={page === 1 || loading} onClick={() => setPage(v => v - 1)}>Trang trước</button><span>Trang {page}</span><button className="outline" disabled={rows.length < 30 || loading} onClick={() => setPage(v => v + 1)}>Trang sau</button></div>
    </section>
  </>;
}
