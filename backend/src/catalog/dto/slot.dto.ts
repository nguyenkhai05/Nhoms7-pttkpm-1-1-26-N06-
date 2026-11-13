import { BadRequestException } from '@nestjs/common';
import { readObject } from './fields.js';

export interface CreateSlotDto {
  start: string;
  end: string;
}

function readTime(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new BadRequestException(`${label} phải có định dạng HH:mm`);
  }
  return value;
}

/** Kiểm tra dữ liệu thêm ca giờ: giờ kết thúc phải sau giờ bắt đầu. */
export function parseCreateSlot(body: unknown): CreateSlotDto {
  const input = readObject(body);
  const dto = {
    start: readTime(input.start, 'Giờ bắt đầu'),
    end: readTime(input.end, 'Giờ kết thúc'),
  };
  if (dto.start >= dto.end) {
    throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
  }
  return dto;
}