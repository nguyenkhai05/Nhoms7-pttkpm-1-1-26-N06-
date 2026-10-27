import { BadRequestException } from '@nestjs/common';

/** Đổi tham số :id trên URL thành số nguyên dương, ngược lại báo lỗi 400. */
export function parseId(value: string, label = 'id'): number {
  const id = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id < 1) {
    throw new BadRequestException(`${label} không hợp lệ`);
  }
  return id;
}