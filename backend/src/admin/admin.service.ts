import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

const STAFF_ROLES = new Set(['ADMIN', 'MANAGER', 'RECEPTIONIST', 'ACCOUNTANT']);
type StaffInput = { fullName?: unknown; email?: unknown; phone?: unknown; password?: unknown; status?: unknown; roles?: unknown };
type UserRow = RowDataPacket & { id: number; fullName: string; email: string; phone: string | null; passwordHash: string; status: string };

@Injectable()
export class AdminService {
  constructor(private readonly db: MysqlDatabase) {}

  private roles(value: unknown): string[] {
    if (!Array.isArray(value) || !value.length || value.some(x => typeof x !== 'string' || !STAFF_ROLES.has(x)) || new Set(value).size !== value.length) {
      throw new BadRequestException('Vai trò nhân sự không hợp lệ.');
    }
    return value as string[];
  }

  private name(value: unknown): string {
    const name = typeof value === 'string' ? value.trim() : '';
    if (name.length < 2 || name.length > 120) throw new BadRequestException('Họ tên phải dài từ 2 đến 120 ký tự.');
    return name;
  }

  private phone(value: unknown): string | null {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !/^[0-9+().\s-]{8,20}$/.test(value.trim())) throw new BadRequestException('Số điện thoại không hợp lệ.');
    return value.trim();
  }

  private password(value: unknown): string {
    if (typeof value !== 'string' || value.length < 8 || value.length > 128) throw new BadRequestException('Mật khẩu phải dài từ 8 đến 128 ký tự.');
    return value;
  }

  async list(q = '', page = 1) {
    if (!Number.isSafeInteger(page) || page < 1) throw new BadRequestException('Số trang không hợp lệ.');
    const search = q.trim();
    if (search.length > 100) throw new BadRequestException('Từ khóa quá dài.');
    const where = "WHERE EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.roleId WHERE ur.userId=u.id AND r.code<>'CUSTOMER')";
    const filter = search ? ' AND (u.fullName LIKE ? OR u.email LIKE ?)' : '';
    const args = search ? [`%${search}%`, `%${search}%`] : [];
    const [rows] = await this.db.pool.execute<any[]>(
      `SELECT u.id,u.fullName,u.email,u.phone,u.status,u.createdAt,
       (SELECT GROUP_CONCAT(r.code ORDER BY r.code) FROM user_roles ur JOIN roles r ON r.id=ur.roleId WHERE ur.userId=u.id) roles
       FROM users u ${where}${filter} ORDER BY u.id DESC LIMIT 30 OFFSET ?`, [...args, (page - 1) * 30]);
    return { items: rows.map((row: any) => ({ ...row, roles: row.roles ? String(row.roles).split(',') : [] })), page, limit: 30 };
  }

  async create(input: unknown, actorId: number) {
    const body = (input ?? {}) as StaffInput;
    const fullName = this.name(body.fullName);
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email không hợp lệ.');
    const phone = this.phone(body.phone);
    const roles = this.roles(body.roles);
    const hash = await bcrypt.hash(this.password(body.password), 12);
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [created] = await c.execute<any>("INSERT INTO users(fullName,email,phone,passwordHash,status) VALUES (?,?,?,?,'ACTIVE')", [fullName, email, phone, hash]);
      for (const role of roles) {
        const [roleRows] = await c.execute<any[]>('SELECT id FROM roles WHERE code=?', [role]);
        if (!roleRows[0]) throw new BadRequestException(`Chưa khởi tạo vai trò ${role} trong database.`);
        await c.execute('INSERT INTO user_roles(userId,roleId) VALUES (?,?)', [created.insertId, roleRows[0].id]);
      }
      await c.execute('INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData) VALUES (?,?,?,?,?)',
        [actorId, 'STAFF_CREATED', 'USER', String(created.insertId), JSON.stringify({ fullName, email, phone, roles, status: 'ACTIVE' })]);
      await c.commit();
      return { id: Number(created.insertId), fullName, email, phone, roles, status: 'ACTIVE' };
    } catch (error: any) {
      await c.rollback();
      if (error?.code === 'ER_DUP_ENTRY') throw new ConflictException('Email này đã được sử dụng.');
      throw error;
    } finally { c.release(); }
  }

  async update(id: number, input: unknown, actorId: number) {
    if (!Number.isSafeInteger(id) || id < 1) throw new BadRequestException('Mã người dùng không hợp lệ.');
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException('Dữ liệu cập nhật không hợp lệ.');
    const body = input as StaffInput;
    const changes = ['fullName', 'phone', 'password', 'status', 'roles'].filter(k => Object.prototype.hasOwnProperty.call(body, k));
    if (!changes.length) throw new BadRequestException('Chưa có thông tin cần cập nhật.');
    const c = await this.db.pool.getConnection();
    try {
      await c.beginTransaction();
      const [rows] = await c.execute<UserRow[]>('SELECT id,fullName,email,phone,passwordHash,status FROM users WHERE id=? FOR UPDATE', [id]);
      const user = rows[0];
      if (!user) throw new NotFoundException('Không tìm thấy tài khoản.');
      const [oldRoles] = await c.execute<any[]>('SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.roleId WHERE ur.userId=?', [id]);
      const previous = oldRoles.map((r: any) => String(r.code));
      if (!previous.some((role: string) => STAFF_ROLES.has(role))) throw new BadRequestException('Chỉ quản lý tài khoản nhân sự.');
      const roles = body.roles === undefined ? previous : this.roles(body.roles);
      const status = body.status === undefined ? user.status : body.status;
      if (status !== 'ACTIVE' && status !== 'LOCKED') throw new BadRequestException('Trạng thái không hợp lệ.');
      if (id === actorId && (status !== 'ACTIVE' || !roles.includes('ADMIN'))) throw new ConflictException('Không thể khóa tài khoản hoặc bỏ vai trò Admin của chính mình.');
      const fullName = body.fullName === undefined ? user.fullName : this.name(body.fullName);
      const phone = body.phone === undefined ? user.phone : this.phone(body.phone);
      const passwordHash = body.password === undefined ? user.passwordHash : await bcrypt.hash(this.password(body.password), 12);
      await c.execute('UPDATE users SET fullName=?,phone=?,status=?,passwordHash=? WHERE id=?', [fullName, phone, status, passwordHash, id]);
      if (body.roles !== undefined) {
        await c.execute('DELETE FROM user_roles WHERE userId=?', [id]);
        for (const role of roles) {
          const [roleRows] = await c.execute<any[]>('SELECT id FROM roles WHERE code=?', [role]);
          if (!roleRows[0]) throw new BadRequestException(`Chưa khởi tạo vai trò ${role} trong database.`);
          await c.execute('INSERT INTO user_roles(userId,roleId) VALUES (?,?)', [id, roleRows[0].id]);
        }
      }
      const before = { fullName: user.fullName, phone: user.phone, status: user.status, roles: previous };
      const after = { fullName, phone, status, roles, passwordChanged: body.password !== undefined };
      await c.execute('INSERT INTO audit_logs(actorId,action,entityType,entityId,beforeData,afterData) VALUES (?,?,?,?,?,?)',
        [actorId, 'STAFF_UPDATED', 'USER', String(id), JSON.stringify(before), JSON.stringify(after)]);
      await c.commit();
      return { id, email: user.email, fullName, phone, status, roles };
    } catch (error: any) {
      await c.rollback();
      if (error?.code === 'ER_DUP_ENTRY') throw new ConflictException('Vai trò đã được gán hoặc dữ liệu bị trùng.');
      throw error;
    } finally { c.release(); }
  }
}
