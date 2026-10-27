import { BadRequestException } from '@nestjs/common';

export interface CreateComplexDto {
  name: string;
  address: string;
  district: string;
  contact: string | null;
  image: string | null;
  description: string | null;
}

export type UpdateComplexDto = Partial<CreateComplexDto>;

type Field = keyof CreateComplexDto;

// Tên hiển thị và độ dài tối đa, khớp bảng complexes trong database/01_schema.sql.
const FIELDS: Record<Field, { label: string; max: number }> = {
  name: { label: 'Tên cụm sân', max: 150 },
  address: { label: 'Địa chỉ', max: 255 },
  district: { label: 'Quận/huyện', max: 100 },
  contact: { label: 'Liên hệ', max: 60 },
  image: { label: 'Ảnh', max: 1000 },
  description: { label: 'Mô tả', max: 65535 },
};

function readObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Dữ liệu gửi lên không hợp lệ');
  }
  return body as Record<string, unknown>;
}

function readText(input: Record<string, unknown>, key: Field, required: true): string;
function readText(input: Record<string, unknown>, key: Field, required: false): string | null;
function readText(input: Record<string, unknown>, key: Field, required: boolean): string | null {
  const { label, max } = FIELDS[key];
  const value = input[key];
  if (value === undefined || value === null) {
    if (required) throw new BadRequestException(`${label} là bắt buộc`);
    return null;
  }
  if (typeof value !== 'string') {
    throw new BadRequestException(`${label} phải là chuỗi`);
  }
  const text = value.trim();
  if (text === '') {
    if (required) throw new BadRequestException(`${label} là bắt buộc`);
    return null;
  }
  if (text.length > max) {
    throw new BadRequestException(`${label} tối đa ${max} ký tự`);
  }
  return text;
}

function readImage(input: Record<string, unknown>): string | null {
  const url = readText(input, 'image', false);
  if (url !== null && !/^https?:\/\//i.test(url)) {
    throw new BadRequestException('Ảnh phải là đường dẫn bắt đầu bằng http:// hoặc https://');
  }
  return url;
}

/** Kiểm tra dữ liệu tạo cụm sân. Trường lạ bị bỏ qua. */
export function parseCreateComplex(body: unknown): CreateComplexDto {
  const input = readObject(body);
  return {
    name: readText(input, 'name', true),
    address: readText(input, 'address', true),
    district: readText(input, 'district', true),
    contact: readText(input, 'contact', false),
    image: readImage(input),
    description: readText(input, 'description', false),
  };
}

/** Kiểm tra dữ liệu sửa: chỉ xét các trường được gửi lên. Gửi chuỗi rỗng ở trường không bắt buộc nghĩa là xóa giá trị. */
export function parseUpdateComplex(body: unknown): UpdateComplexDto {
  const input = readObject(body);
  const dto: UpdateComplexDto = {};
  if ('name' in input) dto.name = readText(input, 'name', true);
  if ('address' in input) dto.address = readText(input, 'address', true);
  if ('district' in input) dto.district = readText(input, 'district', true);
  if ('contact' in input) dto.contact = readText(input, 'contact', false);
  if ('image' in input) dto.image = readImage(input);
  if ('description' in input) dto.description = readText(input, 'description', false);
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('Không có trường nào để cập nhật');
  }
  return dto;
}