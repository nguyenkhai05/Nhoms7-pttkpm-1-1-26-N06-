import { describe, expect, it } from 'vitest';
import { parseCreateSlot } from './slot.dto.js';

describe('parseCreateSlot', () => {
  it('nhận khung giờ hợp lệ và bỏ qua trường lạ', () => {
    expect(parseCreateSlot({ start: '06:00', end: '07:30', hack: 'x' })).toEqual({ start: '06:00', end: '07:30' });
    expect(parseCreateSlot({ start: '00:00', end: '23:59' })).toEqual({ start: '00:00', end: '23:59' });
  });

  it('từ chối giờ sai định dạng hoặc không tồn tại', () => {
    expect(() => parseCreateSlot({ end: '07:30' })).toThrow('Giờ bắt đầu phải có định dạng HH:mm');
    expect(() => parseCreateSlot({ start: '6:00', end: '07:30' })).toThrow('HH:mm');
    expect(() => parseCreateSlot({ start: '06:00', end: '24:00' })).toThrow('Giờ kết thúc phải có định dạng HH:mm');
    expect(() => parseCreateSlot({ start: '06:60', end: '07:30' })).toThrow('HH:mm');
    expect(() => parseCreateSlot(undefined)).toThrow('Dữ liệu gửi lên không hợp lệ');
  });

  it('giờ kết thúc phải sau giờ bắt đầu', () => {
    expect(() => parseCreateSlot({ start: '07:30', end: '07:30' })).toThrow('phải sau giờ bắt đầu');
    expect(() => parseCreateSlot({ start: '08:00', end: '07:30' })).toThrow('phải sau giờ bắt đầu');
  });
});