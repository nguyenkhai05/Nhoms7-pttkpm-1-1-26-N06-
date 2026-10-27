import { Inject, Injectable } from '@nestjs/common';
import type { ResultSetHeader } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { Complex } from './catalog.types.js';
import type { CreateComplexDto, UpdateComplexDto } from './dto/complex.dto.js';

const COLUMNS = 'id,name,address,district,contact,image,description';
// Danh sách cột được phép sửa; tên cột không bao giờ lấy từ dữ liệu người dùng.
const UPDATABLE = ['name', 'address', 'district', 'contact', 'image', 'description'] as const;

/** Chỉ chứa câu SQL của cụm sân; không có quy tắc nghiệp vụ. */
@Injectable()
export class CatalogRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  findAll() {
    return this.db.rows<Complex>(`SELECT ${COLUMNS} FROM complexes ORDER BY id`);
  }

  async findById(id: number): Promise<Complex | null> {
    const [row] = await this.db.rows<Complex>(
      `SELECT ${COLUMNS} FROM complexes WHERE id=?`,
      [id],
    );
    return row ?? null;
  }

  async insert(dto: CreateComplexDto): Promise<number> {
    const [result] = await this.db.pool.execute<ResultSetHeader>(
      'INSERT INTO complexes(name,address,district,contact,image,description) VALUES(?,?,?,?,?,?)',
      [dto.name, dto.address, dto.district, dto.contact, dto.image, dto.description],
    );
    return result.insertId;
  }

  async update(id: number, dto: UpdateComplexDto): Promise<void> {
    const columns = UPDATABLE.filter((column) => dto[column] !== undefined);
    if (columns.length === 0) return;
    // Các cột đã lọc ở trên nên giá trị không phải undefined; `?? null` chỉ để TypeScript yên tâm.
    const values = columns.map((column) => dto[column] ?? null);
    await this.db.pool.execute(
      `UPDATE complexes SET ${columns.map((column) => `${column}=?`).join(',')} WHERE id=?`,
      [...values, id],
    );
  }

  async countPitches(complexId: number): Promise<number> {
    const [row] = await this.db.rows<{ total: number }>(
      'SELECT COUNT(*) AS total FROM pitches WHERE complexId=?',
      [complexId],
    );
    return Number(row?.total ?? 0);
  }

  async remove(id: number): Promise<void> {
    await this.db.pool.execute('DELETE FROM complexes WHERE id=?', [id]);
  }
}