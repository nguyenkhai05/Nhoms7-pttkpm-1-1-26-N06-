import { Injectable } from '@nestjs/common';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import { RegisterDto } from './dto/auth.dto.js';
import { normalizeVietnamesePhone } from './phone.util.js';

export interface UserEntity {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  status: 'ACTIVE' | 'LOCKED';
  createdAt: Date;
}

export interface UserAccess {
  roles: string[];
  permissions: string[];
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    const rows = await this.db.rows<UserEntity>(
      'SELECT id, email, passwordHash, fullName, phone, status, createdAt FROM users WHERE email = ? LIMIT 1',
      [email.trim().toLowerCase()],
    );
    return rows[0] ?? null;
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    const normalizedPhone = normalizeVietnamesePhone(phone);
    const rows = await this.db.rows<UserEntity>(
      'SELECT id, email, passwordHash, fullName, phone, status, createdAt FROM users WHERE phone = ? LIMIT 1',
      [normalizedPhone],
    );
    return rows[0] ?? null;
  }

  async findByUserId(userId: number): Promise<UserEntity | null> {
    const rows = await this.db.rows<UserEntity>(
      'SELECT id, email, passwordHash, fullName, phone, status, createdAt FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    return rows[0] ?? null;
  }

  async findByIdentifier(identifier: string): Promise<UserEntity | null> {
    const value = identifier.trim();
    const isEmail = value.includes('@');
    const normalizedPhone = isEmail ? '' : normalizeVietnamesePhone(value);
    const rows = await this.db.rows<UserEntity>(
      'SELECT id, email, passwordHash, fullName, phone, status, createdAt FROM users WHERE email = ? OR phone = ? LIMIT 1',
      [isEmail ? value.toLowerCase() : '', normalizedPhone],
    );
    return rows[0] ?? null;
  }

  async getUserAccess(userId: number): Promise<UserAccess> {
    const rows = await this.db.rows<RowDataPacket & { roleCode: string; permissionCode: string | null }>(
      `SELECT r.code AS roleCode, p.code AS permissionCode
       FROM user_roles ur
       JOIN roles r ON r.id = ur.roleId
       LEFT JOIN role_permissions rp ON rp.roleId = r.id
       LEFT JOIN permissions p ON p.id = rp.permissionId
       WHERE ur.userId = ?`,
      [userId],
    );
    return {
      roles: [...new Set(rows.map((row) => row.roleCode))],
      permissions: [...new Set(rows.map((row) => row.permissionCode).filter((code): code is string => Boolean(code)))],
    };
  }

  async createCustomer(dto: RegisterDto, passwordHash: string): Promise<number> {
    const connection = await this.db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (email, passwordHash, fullName, phone) VALUES (?, ?, ?, ?)`,
        [dto.email.trim().toLowerCase(), passwordHash, dto.fullName.trim(), dto.phone ? normalizeVietnamesePhone(dto.phone) : null],
      );
      const [roleRows] = await connection.execute<RowDataPacket[]>(
        "SELECT id FROM roles WHERE code = 'CUSTOMER' LIMIT 1",
      );
      if (!roleRows.length) throw new Error("Không tìm thấy vai trò CUSTOMER trong bảng roles. Hãy chạy database/03_seed.sql.");
      await connection.execute('INSERT INTO user_roles (userId, roleId) VALUES (?, ?)', [result.insertId, roleRows[0].id]);
      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
