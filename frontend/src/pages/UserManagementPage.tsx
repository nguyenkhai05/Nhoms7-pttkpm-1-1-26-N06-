import { useEffect, useState, type FormEvent } from 'react';
import PageHead from '../components/PageHead';
import { createUser, listUsers, updateUser, type StaffRole, type StaffUser } from '../features/admin/api';

const roles: StaffRole[] = ['ADMIN','MANAGER','RECEPTIONIST','ACCOUNTANT'];
export default function UserManagementPage() {
  const [users,setUsers] = useState<StaffUser[]>([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [form,setForm] = useState({ fullName:'', email:'', phone:'', password:'', role:'RECEPTIONIST' as StaffRole });
  async function reload() {
    try { setUsers(await listUsers()); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tài khoản.'); }
  }
  useEffect(() => { void reload(); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await createUser(form); await reload();
      setForm({ fullName:'',email:'',phone:'',password:'',role:'RECEPTIONIST' });
      setNotice('Đã tạo tài khoản nhân sự.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tạo được tài khoản.'); }
    finally { setBusy(false); }
  }
  async function change(id: number, data: { role?: StaffRole; status?: StaffUser['status'] }) {
    setBusy(true); setError(''); setNotice('');
    try { await updateUser(id,data); await reload(); setNotice('Đã cập nhật tài khoản và ghi Audit Log.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không cập nhật được tài khoản.'); }
    finally { setBusy(false); }
  }
  return <>
    <PageHead tag="QUẢN TRỊ · UC2.6" title="Tài khoản nhân sự" subtitle="Tạo nhân sự, gán vai trò và khóa hoặc mở tài khoản." />
    {error && <p className="demo-banner" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <section className="panel"><h2>Tạo tài khoản nhân sự</h2>
      <form className="admin-filter" onSubmit={(event) => void submit(event)}>
        <label>Họ tên <input required maxLength={120} value={form.fullName} onChange={(e) => setForm({...form,fullName:e.target.value})} /></label>
        <label>Email <input required type="email" value={form.email} onChange={(e) => setForm({...form,email:e.target.value})} /></label>
        <label>Số điện thoại <input value={form.phone} onChange={(e) => setForm({...form,phone:e.target.value})} /></label>
        <label>Mật khẩu <input required type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({...form,password:e.target.value})} /></label>
        <label>Vai trò <select value={form.role} onChange={(e) => setForm({...form,role:e.target.value as StaffRole})}>
          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
        </select></label>
        <button className="primary" disabled={busy}>Tạo tài khoản</button>
      </form>
    </section>
    <section className="panel"><h2>Danh sách nhân sự</h2>
      <div className="table-wrap"><table className="admin-table"><thead><tr>
        <th>Họ tên</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th>
      </tr></thead><tbody>
        {users.map((user) => <tr key={user.id}>
          <td>{user.fullName}</td><td>{user.email}</td>
          <td><select aria-label={`Vai trò ${user.fullName}`} disabled={busy || user.roles.length !== 1}
            value={user.roles.length === 1 ? user.roles[0] : ''}
            onChange={(e) => void change(user.id,{role:e.target.value as StaffRole})}>
            {user.roles.length !== 1 && <option value="">Nhiều vai trò</option>}
            {roles.map((role) => <option key={role} value={role}>{role}</option>)}
          </select></td>
          <td>{user.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</td>
          <td><button className="outline" disabled={busy} onClick={() => void change(user.id,{status:user.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'})}>
            {user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
          </button></td>
        </tr>)}
        {users.length === 0 && <tr><td colSpan={5}>Không có tài khoản hoặc chưa tải được dữ liệu.</td></tr>}
      </tbody></table></div>
      <p className="muted">Tài khoản đang đăng nhập không thể tự khóa hoặc tự đổi vai trò.</p>
    </section>
  </>;
}
