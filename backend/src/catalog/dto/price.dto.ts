import { BadRequestException } from '@nestjs/common';

export type PriceDayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
export interface PriceDto {
  pitchId?: number;
  dayType?: PriceDayType;
  start?: string;
  end?: string;
  amount?: number;
  depositPercent?: number;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BadRequestException('Dữ liệu bảng giá không hợp lệ');
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER) {
  const result = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(result) || result < min || result > max) {
    throw new BadRequestException(`${label} phải là số nguyên từ ${min} đến ${max}`);
  }
  return result;
}

function time(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new BadRequestException(`${label} phải có định dạng HH:mm`);
  }
  return value;
}

function dayType(value: unknown): PriceDayType {
  if (value !== 'WEEKDAY' && value !== 'WEEKEND' && value !== 'HOLIDAY') {
    throw new BadRequestException('Loại ngày phải là WEEKDAY, WEEKEND hoặc HOLIDAY');
  }
  return value;
}

export function parseCreatePrice(value: unknown): Required<PriceDto> {
  const input = object(value);
  const dto = {
    pitchId: integer(input.pitchId, 'Mã sân', 1),
    dayType: dayType(input.dayType),
    start: time(input.start, 'Giờ bắt đầu'),
    end: time(input.end, 'Giờ kết thúc'),
    amount: integer(input.amount, 'Giá thuê', 1),
    depositPercent: input.depositPercent === undefined ? 30 : integer(input.depositPercent, 'Phần trăm cọc', 1, 100),
  };
  if (dto.start >= dto.end) throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
  return dto;
}

export function parseUpdatePrice(value: unknown): PriceDto {
  const input = object(value);
  const dto: PriceDto = {};
  if ('pitchId' in input) dto.pitchId = integer(input.pitchId, 'Mã sân', 1);
  if ('dayType' in input) dto.dayType = dayType(input.dayType);
  if ('start' in input) dto.start = time(input.start, 'Giờ bắt đầu');
  if ('end' in input) dto.end = time(input.end, 'Giờ kết thúc');
  if ('amount' in input) dto.amount = integer(input.amount, 'Giá thuê', 1);
  if ('depositPercent' in input) dto.depositPercent = integer(input.depositPercent, 'Phần trăm cọc', 1, 100);
  if (!Object.keys(dto).length) throw new BadRequestException('Không có trường nào để cập nhật');
  if (dto.start !== undefined && dto.end !== undefined && dto.start >= dto.end) {
    throw new BadRequestException('Giờ kết thúc phải sau giờ bắt đầu');
  }
  return dto;
}
