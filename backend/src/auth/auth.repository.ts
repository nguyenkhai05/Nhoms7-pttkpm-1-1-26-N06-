import { Injectable } from '@nestjs/common';
import type { ResultSetHeader } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import { RegisterDto } from './dto/auth.dto.js';

// Cập nhật lại interface cho khớp với file schema.sql
export interface UserEntity {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
  phone: string | null;
  status: string;
  createdAt: Date;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly db: MysqlDatabase) {}

  async findByUsername(username: string): Promise<UserEntity | null> {
    const sql = `SELECT * FROM users WHERE email = ? LIMIT 1`;
    const rows = await this.db.rows<UserEntity>(sql, [username]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const sql = `SELECT * FROM users WHERE email = ? LIMIT 1`;
    const rows = await this.db.rows<UserEntity>(sql, [email]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async findByIdentifier(identifier: string): Promise<UserEntity | null> {
    const sql = `SELECT * FROM users WHERE email = ? LIMIT 1`;
    const rows = await this.db.rows<UserEntity>(sql, [identifier]);
    return rows && rows.length > 0 ? rows[0] : null;
  }

  async createUser(dto: RegisterDto, passwordHash: string): Promise<number> {
    // Đã thay thế password -> passwordHash, full_name -> fullName và bỏ cột role
    const sql = `
      INSERT INTO users (email, passwordHash, fullName, phone)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await this.db.pool.execute<ResultSetHeader>(sql, [
      dto.email.trim().toLowerCase(),
      passwordHash,
      dto.fullName.trim(),
      dto.phone ? dto.phone.trim() : null,
    ]);
    return result.insertId;
  }
}