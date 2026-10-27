import { describe, expect, it } from 'vitest';
import { parseCreateComplex, parseUpdateComplex } from './complex.dto.js';
import { parseId } from './id.dto.js';

const valid = { name: ' Cụm sân A ', address: '1 Đường B', district: 'Cầu Giấy' };

describe('parseCreateComplex', () => {
  it('cắt khoảng trắng, để trống thành null và bỏ qua trường lạ', () => {
    expect(parseCreateComplex({ ...valid, contact: '', hack: 'x' })).toEqual({
      name: 'Cụm sân A',
      address: '1 Đường B',
      district: 'Cầu Giấy',
      contact: null,
      image: null,
      description: null,
    });
  });

  it('báo lỗi khi thiếu hoặc rỗng trường bắt buộc', () => {
    expect(() => parseCreateComplex({})).toThrow('Tên cụm sân là bắt buộc');
    expect(() => parseCreateComplex({ ...valid, district: '   ' })).toThrow('Quận/huyện là bắt buộc');
  });

  it('từ chối body không phải đối tượng, sai kiểu và quá dài', () => {
    for (const body of [undefined, null, 'x', [], 5]) {
      expect(() => parseCreateComplex(body)).toThrow('Dữ liệu gửi lên không hợp lệ');
    }
    expect(() => parseCreateComplex({ ...valid, name: 123 })).toThrow('phải là chuỗi');
    expect(() => parseCreateComplex({ ...valid, name: 'a'.repeat(151) })).toThrow('tối đa 150');
  });

  it('chỉ nhận ảnh là đường dẫn http hoặc https', () => {
    expect(parseCreateComplex({ ...valid, image: 'https://a.com/x.png' }).image).toBe('https://a.com/x.png');
    expect(() => parseCreateComplex({ ...valid, image: 'javascript:alert(1)' })).toThrow('http');
  });
});

describe('parseUpdateComplex', () => {
  it('chỉ trả về các trường được gửi lên', () => {
    expect(parseUpdateComplex({ contact: '0911111111' })).toEqual({ contact: '0911111111' });
  });

  it('chuỗi rỗng ở trường không bắt buộc nghĩa là xóa giá trị', () => {
    expect(parseUpdateComplex({ contact: '' })).toEqual({ contact: null });
  });

  it('không cho xóa trống trường bắt buộc và không cho body rỗng', () => {
    expect(() => parseUpdateComplex({ name: '' })).toThrow('Tên cụm sân là bắt buộc');
    expect(() => parseUpdateComplex({})).toThrow('Không có trường nào để cập nhật');
    expect(() => parseUpdateComplex({ hack: 'x' })).toThrow('Không có trường nào để cập nhật');
  });
});

describe('parseId', () => {
  it('nhận số nguyên dương', () => {
    expect(parseId('7')).toBe(7);
  });

  it('từ chối giá trị không hợp lệ', () => {
    for (const value of ['0', '-1', 'x', '1.5', '1 OR 1=1', '']) {
      expect(() => parseId(value)).toThrow('id không hợp lệ');
    }
  });
});