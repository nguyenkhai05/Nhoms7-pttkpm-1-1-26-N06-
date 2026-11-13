import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CatalogHolidayRepository } from './catalog-holiday.repository.js';
import { toHttpError } from './catalog.errors.js';
import { parseCreateHoliday } from './dto/holiday.dto.js';

/** Quy tắc nghiệp vụ của ngày lễ. Không viết SQL ở đây. */
@Injectable()
export class CatalogHolidayService {
  constructor(@Inject(CatalogHolidayRepository) private readonly repository: CatalogHolidayRepository) {}

  listHolidays() {
    return this.repository.list();
  }

  async createHoliday(body: unknown) {
    const dto = parseCreateHoliday(body);
    try {
      await this.repository.insert(dto);
    } catch (error) {
      throw toHttpError(error, { duplicate: 'Ngày này đã có trong danh sách ngày lễ' });
    }
    return { date: dto.date, name: dto.name };
  }

  async deleteHoliday(date: string) {
    if (!(await this.repository.findByDate(date))) {
      throw new NotFoundException('Không tìm thấy ngày lễ');
    }
    await this.repository.remove(date);
    return { date };
  }
}