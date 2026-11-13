import { Inject, Injectable } from '@nestjs/common';
import { MysqlDatabase } from '../database/mysqlDatabase.js';
import type { CreateHolidayDto } from './dto/holiday.dto.js';

export interface Holiday {
  date: string;
  name: string;
}

/** Chỉ chứa câu SQL của bảng holidays; không có quy tắc nghiệp vụ. */
@Injectable()
export class CatalogHolidayRepository {
  constructor(@Inject(MysqlDatabase) private readonly db: MysqlDatabase) {}

  list() {
    return this.db.rows<Holiday>('SELECT date,name FROM holidays ORDER BY date');
  }

  async findByDate(date: string): Promise<Holiday | null> {
    const [row] = await this.db.rows<Holiday>('SELECT date,name FROM holidays WHERE date=?', [date]);
    return row ?? null;
  }

  async insert(dto: CreateHolidayDto): Promise<void> {
    await this.db.pool.execute('INSERT INTO holidays(date,name) VALUES(?,?)', [dto.date, dto.name]);
  }

  async remove(date: string): Promise<void> {
    await this.db.pool.execute('DELETE FROM holidays WHERE date=?', [date]);
  }
}