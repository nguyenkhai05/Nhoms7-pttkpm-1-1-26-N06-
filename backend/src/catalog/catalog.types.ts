export const PITCH_TYPES = [5, 7, 11] as const;
export const PITCH_STATUSES = ['ACTIVE', 'MAINTENANCE', 'INACTIVE'] as const;
export type PitchType = (typeof PITCH_TYPES)[number];
export type PitchStatus = (typeof PITCH_STATUSES)[number];

/** Một dòng của bảng complexes (database/01_schema.sql). */
export interface Complex {
  id: number;
  name: string;
  address: string;
  district: string;
  contact: string | null;
  image: string | null;
  description: string | null;
}

/** Một dòng của bảng amenities. */
export interface Amenity {
  id: number;
  name: string;
}

/** Sân kèm tên cụm sân và danh sách mã tiện ích, dùng cho màn hình quản trị. */
export interface CatalogPitch {
  id: number;
  complexId: number;
  complexName: string;
  name: string;
  type: PitchType;
  grass: string | null;
  lights: string | null;
  status: PitchStatus;
  image: string | null;
  amenityIds: number[];
}