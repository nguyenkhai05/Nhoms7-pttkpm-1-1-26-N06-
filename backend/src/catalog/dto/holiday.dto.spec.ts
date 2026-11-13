import { describe, expect, it } from 'vitest';
import { parseCreateHoliday, parseDate } from './holiday.dto.js';

describe('parseDate', () => {
  it('nhận ngày có thật, kể cả 29/02 của năm nhuận', () => {
    expect(parseDate('2026-09-02')).toBe('2026-09-02');
    expect(parseDate('2024-02-29')).toBe('2024-02-29');
  });

  it('từ chối sai định dạng và ngày không có trong lịch', () => {
    for (const value of [undefined, null, 20260902, '02/09/2026', '2026-9-2']) {
      expect(() => parseDate(value)).toThrow('YYYY-MM-DD');
    }
    for (const value of ['2026-02-30', '2026-04-31', '2025-02-29', '2026-13-01']) {
      expect(() => parseDate(value)).toThrow('không tồn tại trong lịch');
    }
  });
});

describe('parseCreateHoliday', () => {
  it('cắt khoảng trắng và bỏ qua trường lạ', () => {
    expect(parseCreateHoliday({ date: '2026-09-02', name: ' Quốc khánh ', hack: 'x' })).toEqual({
      date: '2026-09-02',
      name: 'Quốc khánh',
    });
  });

  it('báo lỗi khi thiếu hoặc sai dữ liệu', () => {
    expect(() => parseCreateHoliday({ name: 'A' })).toThrow('Ngày lễ phải có định dạng');
    expect(() => parseCreateHoliday({ date: '2026-09-02' })).toThrow('Tên ngày lễ là bắt buộc');
    expect(() => parseCreateHoliday({ date: '2026-09-02', name: 'a'.repeat(151) })).toThrow('tối đa 150');
    expect(() => parseCreateHoliday(undefined)).toThrow('Dữ liệu gửi lên không hợp lệ');
  });
});