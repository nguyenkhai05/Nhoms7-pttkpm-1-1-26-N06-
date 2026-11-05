import { HttpException } from '@nestjs/common';
import { PitchRepository } from '../repositories/pitchRepository.js';
import type { SearchQuery } from '../types.js';

export function fail(message: string, status = 400): never {
  throw new HttpException(message, status);
}

export function positiveId(value: unknown) {
  if (!/^\\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    fail('Mã không hợp lệ');
  }
  return Number(value);
}

export class PitchService {
  constructor(private readonly repository: PitchRepository) {}

  search(query: SearchQuery) {
    let type: number | null = null;
    if (query.type !== undefined && query.type !== '') {
      type = Number(query.type);
      if (!Number.isInteger(type) || ![5, 7, 11].includes(type)) {
        fail('Loại sân phải là 5, 7 hoặc 11');
      }
    }

    const readPrice = (value: string | undefined, label: string): number | null => {
      if (value === undefined || value.trim() === '') return null;
      const price = Number(value);
      if (!Number.isSafeInteger(price) || price < 0) {
        fail(`${label} phải là số nguyên không âm`);
      }
      return price;
    };

    const minPrice = readPrice(query.minPrice, 'Giá từ');
    const maxPrice = readPrice(query.maxPrice, 'Giá đến');
    if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) {
      fail('Giá đến phải lớn hơn hoặc bằng giá từ');
    }

    const district = String(query.district ?? '').trim();
    if (district.length > 100) fail('Quận/huyện không được vượt quá 100 ký tự');

    const rawAmenities = String(query.amenities ?? '').trim();
    const amenities = rawAmenities
      ? [...new Set(rawAmenities.split(',').map((value) => positiveId(value.trim())))]
      : [];
    if (amenities.length > 20) fail('Chỉ được lọc tối đa 20 tiện ích cùng lúc');

    return this.repository.search({ type, minPrice, maxPrice, district, amenities });
  }

  async listAmenities() {
    return this.repository.listAmenities();
  }

  async detail(id: string | number) {
    const pitch = await this.repository.detail(positiveId(id));
    if (!pitch) fail('Không tìm thấy sân', 404);
    return pitch;
  }
}
