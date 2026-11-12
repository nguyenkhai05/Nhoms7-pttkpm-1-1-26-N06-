import { describe, expect, it } from 'vitest';
import { isValidVietnamesePhone, normalizeVietnamesePhone } from './phone.util.js';

describe('normalizeVietnamesePhone', () => {
  it.each([
    ['090 000 0000', '0900000000'],
    ['090-000-0000', '0900000000'],
    ['+84 90 000 0000', '0900000000'],
    ['84900000000', '0900000000'],
    ['+84 090 000 0000', '0900000000'],
    ['900000000', '0900000000'],
  ])('chuẩn hóa %s thành %s', (input, expected) => {
    expect(normalizeVietnamesePhone(input)).toBe(expected);
  });

  it('chỉ chấp nhận số điện thoại Việt Nam đủ 10 chữ số', () => {
    expect(isValidVietnamesePhone('0900000000')).toBe(true);
    expect(isValidVietnamesePhone('090 000 0000')).toBe(false);
    expect(isValidVietnamesePhone('090000000')).toBe(false);
    expect(isValidVietnamesePhone('1234567890')).toBe(false);
  });
});
