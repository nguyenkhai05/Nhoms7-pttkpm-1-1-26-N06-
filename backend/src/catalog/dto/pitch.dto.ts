import { BadRequestException } from '@nestjs/common';
import { PITCH_STATUSES, PITCH_TYPES, type PitchStatus, type PitchType } from '../catalog.types.js';
import {
  isBlank,
  readChoice,
  readIdList,
  readImageUrl,
  readIntChoice,
  readObject,
  readPositiveInt,
  readText,
  type TextRule,
} from './fields.js';

export interface CreatePitchDto {
  complexId: number;
  name: string;
  type: PitchType;
  grass: string | null;
  lights: string | null;
  status: PitchStatus;
  image: string | null;
  amenityIds: number[];
}

export type UpdatePitchDto = Partial<CreatePitchDto>;

// Khớp bảng pitches trong database/01_schema.sql.
const NAME: TextRule = { label: 'Tên sân', max: 100 };
const GRASS: TextRule = { label: 'Loại cỏ', max: 150 };
const LIGHTS: TextRule = { label: 'Hệ thống đèn', max: 150 };

/** Kiểm tra dữ liệu tạo sân. Không gửi trạng thái thì mặc định ACTIVE. */
export function parseCreatePitch(body: unknown): CreatePitchDto {
  const input = readObject(body);
  return {
    complexId: readPositiveInt(input, 'complexId', 'Cụm sân'),
    name: readText(input, 'name', NAME, true),
    type: readIntChoice(input, 'type', 'Loại sân', PITCH_TYPES),
    grass: readText(input, 'grass', GRASS, false),
    lights: readText(input, 'lights', LIGHTS, false),
    status: isBlank(input.status) ? 'ACTIVE' : readChoice(input, 'status', 'Trạng thái', PITCH_STATUSES),
    image: readImageUrl(input),
    amenityIds: readIdList(input, 'amenityIds', 'Tiện ích'),
  };
}

/** Kiểm tra dữ liệu sửa sân. Gửi amenityIds nghĩa là thay toàn bộ danh sách tiện ích. */
export function parseUpdatePitch(body: unknown): UpdatePitchDto {
  const input = readObject(body);
  const dto: UpdatePitchDto = {};
  if ('complexId' in input) dto.complexId = readPositiveInt(input, 'complexId', 'Cụm sân');
  if ('name' in input) dto.name = readText(input, 'name', NAME, true);
  if ('type' in input) dto.type = readIntChoice(input, 'type', 'Loại sân', PITCH_TYPES);
  if ('grass' in input) dto.grass = readText(input, 'grass', GRASS, false);
  if ('lights' in input) dto.lights = readText(input, 'lights', LIGHTS, false);
  if ('status' in input) dto.status = readChoice(input, 'status', 'Trạng thái', PITCH_STATUSES);
  if ('image' in input) dto.image = readImageUrl(input);
  if ('amenityIds' in input) dto.amenityIds = readIdList(input, 'amenityIds', 'Tiện ích');
  if (Object.keys(dto).length === 0) {
    throw new BadRequestException('Không có trường nào để cập nhật');
  }
  return dto;
}