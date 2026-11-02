import { describe, expect, it } from 'vitest';
import { parseCreatePitch, parseUpdatePitch } from './pitch.dto.js';

const valid = { complexId: 1, name: ' Sân 9A ', type: 7 };

describe('parseCreatePitch', () => {
  it('đặt mặc định, cắt khoảng trắng và bỏ trùng tiện ích', () => {
    expect(parseCreatePitch({ ...valid, amenityIds: [2, '1', 2], hack: 'x' })).toEqual({
      complexId: 1,
      name: 'Sân 9A',
      type: 7,
      grass: null,
      lights: null,
      status: 'ACTIVE',
      image: null,
      amenityIds: [2, 1],
    });
  });

  it('nhận số ở dạng chuỗi (dữ liệu từ biểu mẫu)', () => {
    const dto = parseCreatePitch({ complexId: '3', name: 'A', type: '5', status: '' });
    expect(dto).toMatchObject({ complexId: 3, type: 5, status: 'ACTIVE' });
  });

  it('báo lỗi khi thiếu hoặc sai trường bắt buộc', () => {
    expect(() => parseCreatePitch({})).toThrow('Cụm sân là bắt buộc');
    expect(() => parseCreatePitch({ complexId: 0, name: 'A', type: 7 })).toThrow('Cụm sân không hợp lệ');
    expect(() => parseCreatePitch({ complexId: 1, type: 7 })).toThrow('Tên sân là bắt buộc');
    expect(() => parseCreatePitch({ complexId: 1, name: 'A' })).toThrow('Loại sân là bắt buộc');
  });

  it('chỉ nhận loại sân 5, 7, 11 và trạng thái hợp lệ', () => {
    expect(() => parseCreatePitch({ ...valid, type: 6 })).toThrow('Loại sân phải là một trong: 5, 7, 11');
    expect(() => parseCreatePitch({ ...valid, status: 'DELETED' })).toThrow('Trạng thái phải là một trong');
    expect(parseCreatePitch({ ...valid, status: 'MAINTENANCE' }).status).toBe('MAINTENANCE');
  });

  it('từ chối danh sách tiện ích sai và ảnh không phải http', () => {
    expect(() => parseCreatePitch({ ...valid, amenityIds: 'abc' })).toThrow('phải là một danh sách');
    expect(() => parseCreatePitch({ ...valid, amenityIds: [1, 'x'] })).toThrow('có giá trị không hợp lệ');
    expect(() => parseCreatePitch({ ...valid, amenityIds: Array.from({ length: 51 }, (_, i) => i + 1) })).toThrow('tối đa 50');
    expect(() => parseCreatePitch({ ...valid, image: 'ftp://x' })).toThrow('http');
  });
});

describe('parseUpdatePitch', () => {
  it('chỉ trả về các trường được gửi lên', () => {
    expect(parseUpdatePitch({ status: 'INACTIVE' })).toEqual({ status: 'INACTIVE' });
    expect(parseUpdatePitch({ amenityIds: [] })).toEqual({ amenityIds: [] });
  });

  it('chuỗi rỗng ở trường không bắt buộc nghĩa là xóa giá trị', () => {
    expect(parseUpdatePitch({ grass: '' })).toEqual({ grass: null });
  });

  it('không cho xóa trống trường bắt buộc, sai trạng thái hoặc body rỗng', () => {
    expect(() => parseUpdatePitch({ name: '' })).toThrow('Tên sân là bắt buộc');
    expect(() => parseUpdatePitch({ status: '' })).toThrow('Trạng thái phải là một trong');
    expect(() => parseUpdatePitch({})).toThrow('Không có trường nào để cập nhật');
  });
});