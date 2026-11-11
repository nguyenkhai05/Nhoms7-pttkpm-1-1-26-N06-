import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';

export type StaffRole = 'ADMIN' | 'MANAGER' | 'RECEPTIONIST' | 'ACCOUNTANT';
export interface StaffUser {
  id: number; fullName: string; email: string; phone: string | null;
  status: 'ACTIVE' | 'LOCKED'; roles: string[]; createdAt: string;
}
interface StaffRow extends RowDataPacket {
  id: number; fullName: string; email: string; phone: string | null;
  status: 'ACTIVE' | 'LOCKED'; roleCodes: string | null; createdAt: string;
}
const STAFF_SQL = `SELECT u.id,u.fullName,u.email,u.phone,u.status,u.createdAt,
  GROUP_CONCAT(r.code ORDER BY r.code) AS roleCodes
  FROM users u LEFT JOIN user_roles ur ON ur.userId=u.id
  LEFT JOIN roles r ON r.id=ur.roleId
  GROUP BY u.id,u.fullName,u.email,u.phone,u.status,u.createdAt`;
function staff(row: StaffRow): StaffUser {
  return { id: row.id, fullName: row.fullName, email: row.email, phone: row.phone,
    status: row.status, createdAt: row.createdAt, roles: row.roleCodes?.split(',') ?? [] };
}

@Injectable()
export class AdminRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async users(): Promise<StaffUser[]> {
    const rows = await this.db.rows<StaffRow>(`${STAFF_SQL} HAVING FIND_IN_SET('CUSTOMER',roleCodes)=0 ORDER BY u.id DESC LIMIT 200`);
    return rows.map(staff);
  }

  async create(actorId: number, ip: string | undefined, data: { fullName: string; email: string; phone: string | null; passwordHash: string; role: StaffRole }) {
    const connection = await this.db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO users(fullName,email,phone,passwordHash) VALUES(?,?,?,?)',
        [data.fullName, data.email, data.phone, data.passwordHash]);
      const [roles] = await connection.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code=?', [data.role]);
      if (!roles.length) throw new ConflictException('Chưa tạo vai trò nhân sự trong database.');
      await connection.execute('INSERT INTO user_roles(userId,roleId) VALUES(?,?)', [result.insertId, roles[0].id]);
      await connection.execute(
        `INSERT INTO audit_logs(actorId,action,entityType,entityId,afterData,ip)
         VALUES(?,'USER_CREATE','USER',?,?,?)`,
        [actorId, String(result.insertId), JSON.stringify({ fullName: data.fullName, email: data.email, role: data.role, status: 'ACTIVE' }), ip ?? null]);
      await connection.commit();
      return { id: result.insertId };
    } catch (error) {
      await connection.rollback();
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw new ConflictException('Email đã tồn tại.');
      throw error;
    } finally { connection.release(); }
  }

  async update(actorId: number, ip: string | undefined, id: number, changes: { fullName?: string; phone?: string | null; status?: 'ACTIVE' | 'LOCKED'; role?: StaffRole }) {
    const connection = await this.db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute<StaffRow[]>(
        'SELECT id,fullName,email,phone,status,createdAt FROM users WHERE id=? FOR UPDATE', [id]);
      const [roleRows] = await connection.execute<RowDataPacket[]>(
        'SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.roleId WHERE ur.userId=? ORDER BY r.code', [id]);
      const codes = roleRows.map((row) => String(row.code));
      if (!rows.length || !codes.length || codes.includes('CUSTOMER')) throw new NotFoundException('Không tìm thấy nhân sự.');
      const before: StaffUser = { id: rows[0].id, fullName: rows[0].fullName, email: rows[0].email,
        phone: rows[0].phone, status: rows[0].status, createdAt: rows[0].createdAt, roles: codes };
      if (before.status === 'ACTIVE' && codes.includes('ADMIN') &&
          (changes.status === 'LOCKED' || changes.role && changes.role !== 'ADMIN')) {
        const [adminRows] = await connection.execute<RowDataPacket[]>(
          `SELECT COUNT(DISTINCT u.id) AS activeAdmins FROM users u
           JOIN user_roles ur ON ur.userId=u.id JOIN roles r ON r.id=ur.roleId
           WHERE r.code='ADMIN' AND u.status='ACTIVE'`);
        if (Number(adminRows[0].activeAdmins) <= 1) throw new ConflictException('Không thể khóa hoặc hạ quyền quản trị viên cuối cùng.');
      }
      const after = { ...before,
        fullName: changes.fullName ?? before.fullName, phone: changes.phone === undefined ? before.phone : changes.phone,
        status: changes.status ?? before.status, roles: changes.role ? [changes.role] : before.roles };
      await connection.execute('UPDATE users SET fullName=?,phone=?,status=? WHERE id=?', [after.fullName, after.phone, after.status, id]);
      if (changes.role) {
        const [roles] = await connection.execute<RowDataPacket[]>('SELECT id FROM roles WHERE code=?', [changes.role]);
        if (!roles.length) throw new ConflictException('Vai trò không tồn tại trong database.');
        await connection.execute('DELETE FROM user_roles WHERE userId=?', [id]);
        await connection.execute('INSERT INTO user_roles(userId,roleId) VALUES(?,?)', [id, roles[0].id]);
      }
      await connection.execute(`INSERT INTO audit_logs(actorId,action,entityType,entityId,beforeData,afterData,ip)
        VALUES(?,'USER_UPDATE','USER',?,?,?,?)`, [actorId, String(id), JSON.stringify(before), JSON.stringify(after), ip ?? null]);
      await connection.commit();
      return after;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async audit(filters: { actorId?: number; action?: string; entityType?: string; from?: string; to?: string; limit: number }) {
    const where: string[] = [];
    const args: (string | number)[] = [];
    if (filters.actorId) { where.push('a.actorId=?'); args.push(filters.actorId); }
    if (filters.action) { where.push('a.action=?'); args.push(filters.action); }
    if (filters.entityType) { where.push('a.entityType=?'); args.push(filters.entityType); }
    if (filters.from) { where.push('a.createdAt>=?'); args.push(filters.from); }
    if (filters.to) { where.push('a.createdAt<?'); args.push(filters.to); }
    // LIMIT is a validated integer, embedded because MySQL prepared LIMIT differs by driver version.
    return this.db.rows<{ id: number; actorId: number | null; actorName: string | null; action: string; entityType: string; entityId: string | null; beforeData: unknown; afterData: unknown; createdAt: string }>(
      `SELECT a.id,a.actorId,u.fullName AS actorName,a.action,a.entityType,a.entityId,a.beforeData,a.afterData,a.createdAt
       FROM audit_logs a LEFT JOIN users u ON u.id=a.actorId ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.createdAt DESC,a.id DESC LIMIT ${filters.limit}`, args);
  }
}
