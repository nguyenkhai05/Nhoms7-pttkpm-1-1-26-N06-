import { BadRequestException } from '@nestjs/common';
import { readImageUrl, readObject, readText, type TextRule } from './fields.js';

export interface CreateComplexDto {
  name: string;
  address: string;
  district: string;
  contact: string | null;
  image: string | null;
  description: string | null;
}

export type UpdateComplexDto = Partial<CreateComplexDto>;

// Tên hiển thị và độ dài tối đa, khớp bảng complexes trong database/01_schema.sql.
const RULES = {
  name: { label: 'Tên cụm sân', max: 150 },
  address: { label: 'Địa chỉ', max: 255 },
  district: { label: 'Quận/huyện', max: 100 },
  contact: { label: 'Liên hệ', max: 60 },
  description: { label: 'Mô tả', max: 65535 },
} satisfies Record<string, TextRule>;

/** Kiểm tra dữ liệu tạo cụm sân. Trường lạ bị bỏ qua. */
export function parseCreateComplex(body: unknown): CreateComplexDto {
  const input = readObject(body);
  return {
    name: readText(input, 'name', RULES.name, true),
    address: readText(input, 'address', RULES.address, true),
    district: readText(input, 'district', RULES.district, true),
    contact: readText(input, 'contact', RULES.contact, false),
    image: readImageUrl(input),
    description: readText(input, 'description', RULES.description, false),
  };
}

/** Kiểm tra dữ liệu sửa: chỉ xét các trường được gửi lên. Gửi chuỗi rỗng ở trường không bắt buộc nghĩa là xóa giá trị. */
export function parseUpdateComplex(body: unknown): UpdateComplexDto {
  const input = readObject(body);
  const dto: UpdateComplexDto = {};
  if ('name' in input) dto.name = readText(input, 'name', RULES.name, true);
  if ('address' in input) dto.address = readText(input, 'address', RULES.address, true);
  if ('district' in input) dto.district = readText(input, 'district', RULES.district, true);
  if ('contact' in input) dto.contact = readText(input, 'contact', RULES.contact, false);
  if ('image' in input) dto.image = readImageUrl(input);
  if ('description' in input) dto.description = readText(input, 'description', RULES.description, false);
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('Không có trường nào để cập nhật');
  }
  return dto;
}