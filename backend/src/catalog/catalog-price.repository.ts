import { Inject, Injectable } from '@nestjs/common';
import type { ResultSetHeader } from 'mysql2/promise';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { PriceDto } from './dto/price.dto.js';

export interface CatalogPrice {
  id: number;
  pitchId: number;
  pitchName: string;
  complexName: string;
  dayType: 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
  start: string;
  end: string;
  amount: number;
  depositPercent: number;
}

@Injectable()
export class CatalogPriceRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  list() {
    return this.db.rows<CatalogPrice>(
      'SELECT r.*,p.name AS pitchName,c.name AS complexName FROM prices r JOIN pitches p ON p.id=r.pitchId JOIN complexes c ON c.id=p.complexId ORDER BY c.name,p.name,r.dayType,r.`start`',
    );
  }

  async findById(id: number) {
    const [row] = await this.db.rows<CatalogPrice>(
      'SELECT r.*,p.name AS pitchName,c.name AS complexName FROM prices r JOIN pitches p ON p.id=r.pitchId JOIN complexes c ON c.id=p.complexId WHERE r.id=?',
      [id],
    );
    return row ?? null;
  }

  async pitchExists(id: number) {
    const rows = await this.db.rows<{ id: number }>('SELECT id FROM pitches WHERE id=?', [id]);
    return rows.length > 0;
  }

  async hasOverlap(dto: Required<Pick<PriceDto, 'pitchId' | 'dayType' | 'start' | 'end'>>, exceptId?: number) {
    const rows = await this.db.rows<{ id: number }>(
      'SELECT id FROM prices WHERE pitchId=? AND dayType=? AND `start`<? AND `end`>? AND id<>?',
      [dto.pitchId, dto.dayType, dto.end, dto.start, exceptId ?? 0],
    );
    return rows.length > 0;
  }

  async insert(dto: Required<PriceDto>) {
    const [result] = await this.db.pool.execute<ResultSetHeader>(
      'INSERT INTO prices(pitchId,dayType,`start`,`end`,amount,depositPercent) VALUES(?,?,?,?,?,?)',
      [dto.pitchId, dto.dayType, dto.start, dto.end, dto.amount, dto.depositPercent],
    );
    return result.insertId;
  }

  async update(id: number, dto: PriceDto) {
    const columns = ['pitchId', 'dayType', 'start', 'end', 'amount', 'depositPercent'] as const;
    const selected = columns.filter((column) => dto[column] !== undefined);
    await this.db.pool.execute(
      `UPDATE prices SET ${selected.map((column) => `\`${column}\`=?`).join(',')} WHERE id=?`,
      [...selected.map((column) => dto[column]), id],
    );
  }

  async remove(id: number) {
    await this.db.pool.execute('DELETE FROM prices WHERE id=?', [id]);
  }
}
