import { Inject, Injectable } from '@nestjs/common';
import type { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { Amenity, CatalogPitch } from './catalog.types.js';
import type { CreatePitchDto, UpdatePitchDto } from './dto/pitch.dto.js';

type PitchRow = Omit<CatalogPitch, 'amenityIds'>;

const SELECT_PITCH =
  'SELECT p.id,p.complexId,c.name AS complexName,p.name,p.type,p.grass,p.lights,p.status,p.image ' +
  'FROM pitches p JOIN complexes c ON c.id=p.complexId';
// Danh sách cột được phép sửa; tên cột không bao giờ lấy từ dữ liệu người dùng.
const UPDATABLE = ['complexId', 'name', 'type', 'grass', 'lights', 'status', 'image'] as const;

/** Chỉ chứa câu SQL của sân và tiện ích; không có quy tắc nghiệp vụ. */
@Injectable()
export class CatalogPitchRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  listAmenities() {
    return this.db.rows<Amenity>('SELECT id,name FROM amenities ORDER BY id');
  }

  async complexExists(id: number): Promise<boolean> {
    const rows = await this.db.rows<{ id: number }>('SELECT id FROM complexes WHERE id=?', [id]);
    return rows.length > 0;
  }

  async findAll(complexId?: number): Promise<CatalogPitch[]> {
    const rows =
      complexId === undefined
        ? await this.db.rows<PitchRow>(`${SELECT_PITCH} ORDER BY p.id`)
        : await this.db.rows<PitchRow>(`${SELECT_PITCH} WHERE p.complexId=? ORDER BY p.id`, [complexId]);
    return this.withAmenities(rows);
  }

  async findById(id: number): Promise<CatalogPitch | null> {
    const rows = await this.db.rows<PitchRow>(`${SELECT_PITCH} WHERE p.id=?`, [id]);
    const [pitch] = await this.withAmenities(rows);
    return pitch ?? null;
  }

  async insert(dto: CreatePitchDto): Promise<number> {
    return this.inTransaction(async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO pitches(complexId,name,type,grass,lights,status,image) VALUES(?,?,?,?,?,?,?)',
        [dto.complexId, dto.name, dto.type, dto.grass, dto.lights, dto.status, dto.image],
      );
      await this.replaceAmenities(connection, result.insertId, dto.amenityIds);
      return result.insertId;
    });
  }

  async update(id: number, dto: UpdatePitchDto): Promise<void> {
    const columns = UPDATABLE.filter((column) => dto[column] !== undefined);
    await this.inTransaction(async (connection) => {
      // Cùng khóa với sp_hold_slot để không sửa sân giữa lúc đang giữ ca.
      await connection.execute('SELECT id FROM pitches WHERE id=? FOR UPDATE', [id]);
      if (columns.length > 0) {
        const values = columns.map((column) => dto[column] ?? null);
        await connection.execute(
          `UPDATE pitches SET ${columns.map((column) => `${column}=?`).join(',')} WHERE id=?`,
          [...values, id],
        );
      }
      if (dto.amenityIds !== undefined) {
        await this.replaceAmenities(connection, id, dto.amenityIds);
      }
    });
  }

  /** Số ca đang bị chiếm (đã cọc hoặc đang giữ) từ hôm nay (giờ Việt Nam) trở đi. */
  async countUpcomingBookings(pitchId: number): Promise<number> {
    const [row] = await this.db.rows<{ total: number }>(
      'SELECT COUNT(*) AS total FROM slot_occupancy WHERE pitchId=? ' +
        'AND date>=DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR) ' +
        "AND (state='CONFIRMED' OR expiresAt>UTC_TIMESTAMP())",
      [pitchId],
    );
    return Number(row?.total ?? 0);
  }

  /** Số ca, dòng giá và lịch bảo trì đang gắn với sân (các bảng này chặn xóa sân). */
  async countDependents(pitchId: number): Promise<{ slots: number; prices: number; blocks: number }> {
    const [row] = await this.db.rows<{ slots: number; prices: number; blocks: number }>(
      'SELECT (SELECT COUNT(*) FROM slots WHERE pitchId=?) AS slots,' +
        '(SELECT COUNT(*) FROM prices WHERE pitchId=?) AS prices,' +
        '(SELECT COUNT(*) FROM pitch_blocks WHERE pitchId=?) AS blocks',
      [pitchId, pitchId, pitchId],
    );
    return {
      slots: Number(row?.slots ?? 0),
      prices: Number(row?.prices ?? 0),
      blocks: Number(row?.blocks ?? 0),
    };
  }

  async remove(id: number): Promise<void> {
    await this.inTransaction(async (connection) => {
      await connection.execute('SELECT id FROM pitches WHERE id=? FOR UPDATE', [id]);
      await connection.execute('DELETE FROM pitch_amenities WHERE pitchId=?', [id]);
      await connection.execute('DELETE FROM pitch_images WHERE pitchId=?', [id]);
      await connection.execute('DELETE FROM pitches WHERE id=?', [id]);
    });
  }

  private async withAmenities(rows: PitchRow[]): Promise<CatalogPitch[]> {
    if (rows.length === 0) return [];
    const links = await this.db.rows<{ pitchId: number; amenityId: number }>(
      `SELECT pitchId,amenityId FROM pitch_amenities WHERE pitchId IN (${rows.map(() => '?').join(',')}) ORDER BY amenityId`,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({
      ...row,
      amenityIds: links.filter((link) => link.pitchId === row.id).map((link) => link.amenityId),
    }));
  }

  private async replaceAmenities(connection: PoolConnection, pitchId: number, amenityIds: number[]) {
    await connection.execute('DELETE FROM pitch_amenities WHERE pitchId=?', [pitchId]);
    if (amenityIds.length === 0) return;
    await connection.execute(
      `INSERT INTO pitch_amenities(pitchId,amenityId) VALUES ${amenityIds.map(() => '(?,?)').join(',')}`,
      amenityIds.flatMap((amenityId) => [pitchId, amenityId]),
    );
  }

  /** Chạy một nhóm câu lệnh trong cùng một giao dịch: hoặc tất cả thành công, hoặc hoàn tác hết. */
  private async inTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}