export interface ReportDay { date: string; pitch: number; service: number; refunded: number; net: number }
export interface Report {
  from: string; to: string; confirmedBookings: number; pendingBookings: number;
  filledSlots: number; availableSlots: number; occupancyPercent: number;
  pitchCollected: number; serviceCollected: number; refunded: number; netCollected: number;
  daily: ReportDay[];
}
export interface StaffUser {
  id: number; fullName: string; email: string; phone: string | null;
  status: 'ACTIVE' | 'LOCKED'; roles: string[]; createdAt: string;
}
export interface AuditEntry {
  id: number; actorId: number | null; actorName: string | null; action: string;
  entityType: string; entityId: string | null; beforeData: unknown; afterData: unknown; createdAt: string;
}
export type StaffRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body) headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(`/api/${path}`, { ...options, headers }); }
  catch { throw new Error('Không kết nối được backend.'); }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === 'object' && 'message' in payload ? payload.message : null;
    throw new Error(typeof message === 'string' ? message : `API trả về lỗi HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Phản hồi API thiếu data.');
  return (payload as { data: T }).data;
}
const range = (from: string, to: string) => new URLSearchParams({ from, to }).toString();
export function getReport(from: string, to: string) { return request<Report>(`reports/summary?${range(from,to)}`); }
export async function downloadReport(from: string, to: string) {
  const token = localStorage.getItem('accessToken');
  const response = await fetch(`/api/reports/export?${range(from,to)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error(`Không xuất được báo cáo (HTTP ${response.status}).`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = `bao-cao-${from}-${to}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function listUsers() { return request<StaffUser[]>('admin/users'); }
export function createUser(data: { fullName: string; email: string; phone: string; password: string; role: StaffRole }) {
  return request<{ id: number }>('admin/users', { method: 'POST', body: JSON.stringify(data) });
}
export function updateUser(id: number, data: { status?: StaffUser['status']; role?: StaffRole; fullName?: string; phone?: string }) {
  return request<StaffUser>(`admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
export function listAudit(filters: { actorId?: string; action?: string; entityType?: string; from?: string; to?: string }) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key,value]) => { if (value) query.set(key,value); });
  return request<AuditEntry[]>(`admin/audit-logs?${query}`);
}
