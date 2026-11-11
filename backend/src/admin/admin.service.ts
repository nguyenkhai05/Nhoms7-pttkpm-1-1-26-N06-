import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminRepository, type StaffRole } from './admin.repository.js';

const ROLES: StaffRole[] = ['ADMIN','MANAGER','RECEPTIONIST','ACCOUNTANT'];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
}
function requiredString(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestException(`${label} không hợp lệ.`);
  return value.trim();
}
function role(value: unknown): StaffRole {
  if (typeof value !== 'string' || !ROLES.includes(value as StaffRole)) throw new BadRequestException('Vai trò nhân sự không hợp lệ.');
  return value as StaffRole;
}
function date(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}

@Injectable()
export class AdminService {
  constructor(private readonly repository: AdminRepository) {}
  users() { return this.repository.users(); }

  async create(actorId: number, ip: string | undefined, input: unknown) {
    const data = object(input);
    const fullName = requiredString(data.fullName, 'Họ tên', 120);
    const email = requiredString(data.email, 'Email', 190).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email không hợp lệ.');
    const password = requiredString(data.password, 'Mật khẩu', 100);
    if (password.length < 8) throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự.');
    const phone = data.phone == null || data.phone === '' ? null : requiredString(data.phone, 'Số điện thoại', 30);
    const passwordHash = await bcrypt.hash(password, 12);
    return this.repository.create(actorId, ip, { fullName, email, phone, passwordHash, role: role(data.role) });
  }

  async update(actorId: number, ip: string | undefined, rawId: string, input: unknown) {
    const id = Number(rawId), data = object(input);
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Mã nhân sự không hợp lệ.');
    if (!Object.keys(data).length || Object.keys(data).some((key) => !['fullName','phone','status','role'].includes(key)))
      throw new BadRequestException('Chỉ được sửa tên, số điện thoại, trạng thái hoặc vai trò.');
    if (id === actorId && (data.status !== undefined || data.role !== undefined))
      throw new ForbiddenException('Không tự đổi vai trò hoặc khóa tài khoản đang sử dụng.');
    const changes: { fullName?: string; phone?: string | null; status?: 'ACTIVE' | 'LOCKED'; role?: StaffRole } = {};
    if (data.fullName !== undefined) changes.fullName = requiredString(data.fullName, 'Họ tên', 120);
    if (data.phone !== undefined) changes.phone = data.phone == null || data.phone === '' ? null : requiredString(data.phone, 'Số điện thoại', 30);
    if (data.status !== undefined) {
      if (data.status !== 'ACTIVE' && data.status !== 'LOCKED') throw new BadRequestException('Trạng thái không hợp lệ.');
      changes.status = data.status;
    }
    if (data.role !== undefined) changes.role = role(data.role);
    return this.repository.update(actorId, ip, id, changes);
  }

  async audit(query: Record<string, string>) {
    const filters: { actorId?: number; action?: string; entityType?: string; from?: string; to?: string; limit: number } = { limit: 100 };
    if (query.actorId) {
      const id = Number(query.actorId);
      if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('Mã người thực hiện không hợp lệ.');
      filters.actorId = id;
    }
    for (const field of ['action','entityType'] as const) {
      if (query[field]) filters[field] = requiredString(query[field], field, 100);
    }
    if (query.from && !date(query.from) || query.to && !date(query.to) || query.from && query.to && query.from > query.to)
      throw new BadRequestException('Khoảng ngày không hợp lệ.');
    if (query.from) filters.from = `${query.from} 00:00:00`;
    if (query.to) {
      const next = new Date(Date.parse(`${query.to}T00:00:00Z`) + 86400000).toISOString().slice(0,10);
      filters.to = `${next} 00:00:00`;
    }
    if (query.limit !== undefined) {
      const limit = Number(query.limit);
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new BadRequestException('Giới hạn từ 1 đến 200.');
      filters.limit = limit;
    }
    return this.repository.audit(filters);
  }
}
