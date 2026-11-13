import { describe, expect, it } from 'vitest';
import { uncoveredDayTypes, type PriceWindow } from './catalog-slot.coverage.js';

const rule = (dayType: PriceWindow['dayType'], start: string, end: string): PriceWindow => ({ dayType, start, end });
const full = [
  rule('WEEKDAY', '06:00', '17:00'), rule('WEEKDAY', '17:00', '22:00'),
  rule('WEEKEND', '06:00', '22:00'),
  rule('HOLIDAY', '06:00', '22:00'),
];

describe('uncoveredDayTypes', () => {
  it('ca nằm trọn trong một khung giá thì đủ cho cả ba loại ngày', () => {
    expect(uncoveredDayTypes({ start: '07:30', end: '09:00' }, full)).toEqual([]);
    expect(uncoveredDayTypes({ start: '17:00', end: '18:30' }, full)).toEqual([]);
  });

  it('ca vắt qua hai khung giá thì thiếu giá ở loại ngày bị cắt', () => {
    expect(uncoveredDayTypes({ start: '16:00', end: '17:30' }, full)).toEqual(['WEEKDAY']);
  });

  it('ca ngoài mọi khung giá hoặc loại ngày chưa có giá thì báo thiếu', () => {
    expect(uncoveredDayTypes({ start: '22:00', end: '23:00' }, full)).toEqual(['WEEKDAY', 'WEEKEND', 'HOLIDAY']);
    expect(uncoveredDayTypes({ start: '07:00', end: '08:00' }, full.filter((r) => r.dayType !== 'HOLIDAY'))).toEqual(['HOLIDAY']);
  });

  it('hai khung giá cùng chứa ca (trùng giá) cũng bị coi là không đặt được', () => {
    const overlapped = [...full, rule('WEEKEND', '06:00', '12:00')];
    expect(uncoveredDayTypes({ start: '07:00', end: '08:30' }, overlapped)).toEqual(['WEEKEND']);
  });
});