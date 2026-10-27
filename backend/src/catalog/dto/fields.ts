import { BadRequestException } from '@nestjs/common';

export type Input = Record<string, unknown>;

export interface TextRule {
  label: string;
  max: number;
}

export function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

export function readObject(body: unknown): Input {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestException('Dữ liệu gửi lên không hợp lệ');
  }
  return body as Input;
}

export function readText(input: Input, key: string, rule: TextRule, required: true): string;
export function readText(input: Input, key: string, rule: TextRule, required: false): string | null;
export function readText(input: Input, key: string, { label, max }: TextRule, required: boolean): string | null {
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

/** Ảnh là trường không bắt buộc, nếu có phải là đường dẫn http(s). */
export function readImageUrl(input: Input, rule: TextRule = { label: 'Ảnh', max: 1000 }): string | null {
  const url = readText(input, 'image', rule, false);
  if (url !== null && !/^https?:\/\//i.test(url)) {
    throw new BadRequestException(`${rule.label} phải là đường dẫn bắt đầu bằng http:// hoặc https://`);
  }
  return url;
}

/** Nhận số nguyên dương dạng số hoặc chuỗi số ("7"); trả NaN nếu không hợp lệ. */
function toInt(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return Number.NaN;
}

export function readPositiveInt(input: Input, key: string, label: string): number {
  const value = input[key];
  if (isBlank(value)) throw new BadRequestException(`${label} là bắt buộc`);
  const number = toInt(value);
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new BadRequestException(`${label} không hợp lệ`);
  }
  return number;
}

export function readIntChoice<T extends number>(input: Input, key: string, label: string, allowed: readonly T[]): T {
  const number = readPositiveInt(input, key, label);
  if (!allowed.includes(number as T)) {
    throw new BadRequestException(`${label} phải là một trong: ${allowed.join(', ')}`);
  }
  return number as T;
}

export function readChoice<T extends string>(input: Input, key: string, label: string, allowed: readonly T[]): T {
  const value = input[key];
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new BadRequestException(`${label} phải là một trong: ${allowed.join(', ')}`);
  }
  return value as T;
}

/** Danh sách mã (ví dụ mã tiện ích): bỏ trùng, không có thì trả về mảng rỗng. */
export function readIdList(input: Input, key: string, label: string, maxItems = 50): number[] {
  const value = input[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequestException(`${label} phải là một danh sách`);
  if (value.length > maxItems) throw new BadRequestException(`${label} tối đa ${maxItems} mục`);
  const ids = value.map((item) => {
    const number = toInt(item);
    if (!Number.isSafeInteger(number) || number < 1) {
      throw new BadRequestException(`${label} có giá trị không hợp lệ`);
    }
    return number;
  });
  return [...new Set(ids)];
}