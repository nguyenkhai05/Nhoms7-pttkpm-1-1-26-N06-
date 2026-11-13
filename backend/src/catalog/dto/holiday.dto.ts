import { BadRequestException } from '@nestjs/common';
import { readObject, readText, type TextRule } from './fields.js';

export interface CreateHolidayDto {
  date: string;
  name: string;
}

const NAME: TextRule = { label: 'Tên ngày lễ', max: 150 };

/** Nhận ngày dạng YYYY-MM-DD và phải là một ngày có thật trong lịch (không nhận 2026-02-30). */
export function parseDate(value: unknown, label = 'Ngày'): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${label} phải có định dạng YYYY-MM-DD`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${label} không tồn tại trong lịch`);
  }
  return value;
}

/** Kiểm tra dữ liệu thêm ngày lễ. Trường lạ bị bỏ qua. */
export function parseCreateHoliday(body: unknown): CreateHolidayDto {
  const input = readObject(body);
  return {
    date: parseDate(input.date, 'Ngày lễ'),
    name: readText(input, 'name', NAME, true),
  };
}