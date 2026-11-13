import { Inject, Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { PriceWindow } from './catalog-slot.coverage.js';
import { inTransaction } from './catalog.transaction.js';
import type { CreateSlotDto } from './dto/slot.dto.js';

export interface CatalogSlot {
  id: number;
  pitchId: number;
  start: string;
  end: string;
}

/** Chỉ chứa câu SQL của ca giờ; không có quy tắc nghiệp vụ. */
@Injectable()
export class CatalogSlotRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  async pitchExists(pitchId: number): Promise<boolean> {
    const rows = await this.db.rows<{ id: number }>('SELECT id FROM pitches WHERE id=?', [pitchId]);
    return rows.length > 0;
  }

  list(pitchId: number) {
    return this.db.rows<CatalogSlot>(
      'SELECT id,pitchId,`start`,`end` FROM slots WHERE pitchId=? ORDER BY `start`',
      [pitchId],
    );
  }

  async findById(pitchId: number, slotId: number): Promise<CatalogSlot | null> {
    const [row] = await this.db.rows<CatalogSlot>(
      'SELECT id,pitchId,`start`,`end` FROM slots WHERE id=? AND pitchId=?',
      [slotId, pitchId],
    );
    return row ?? null;
  }

  priceWindows(pitchId: number) {
    return this.db.rows<PriceWindow>('SELECT dayType,`start`,`end` FROM prices WHERE pitchId=?', [pitchId]);
  }

  /** Dùng sp_add_slot: thủ tục tự khóa dòng sân và chặn ca chồng nhau. Trả về mã ca mới. */
  async insert(pitchId: number, dto: CreateSlotDto): Promise<number> {
    await this.db.pool.query('CALL sp_add_slot(?,?,?)', [pitchId, dto.start, dto.end]);
    const [row] = await this.db.rows<{ id: number }>(
      'SELECT id FROM slots WHERE pitchId=? AND `start`=? AND `end`=?',
      [pitchId, dto.start, dto.end],
    );
    return row.id;
  }

  /** Số đơn đặt và số dòng giữ chỗ (kể cả lịch sử) đang tham chiếu tới ca. */
  async countUsage(slotId: number): Promise<number> {
    const [row] = await this.db.rows<{ bookings: number; occupancy: number }>(
      'SELECT (SELECT COUNT(*) FROM bookings WHERE slotId=?) AS bookings,' +
        '(SELECT COUNT(*) FROM slot_occupancy WHERE slotId=?) AS occupancy',
      [slotId, slotId],
    );
    return Number(row?.bookings ?? 0) + Number(row?.occupancy ?? 0);
  }

  async remove(pitchId: number, slotId: number): Promise<void> {
    await inTransaction(this.db, async (connection) => {
      // Cùng khóa với sp_hold_slot và sp_add_slot: mọi thay đổi ca phải khóa dòng sân trước.
      await connection.execute('SELECT id FROM pitches WHERE id=? FOR UPDATE', [pitchId]);
      await connection.execute('DELETE FROM slots WHERE id=? AND pitchId=?', [slotId, pitchId]);
    });
  }
}