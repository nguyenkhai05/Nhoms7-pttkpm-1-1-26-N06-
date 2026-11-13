export const PITCH_TYPES = [5, 7, 11] as const;
export const PITCH_STATUSES = ["ACTIVE", "MAINTENANCE", "INACTIVE"] as const;
export type PitchType = (typeof PITCH_TYPES)[number];
export type PitchStatus = (typeof PITCH_STATUSES)[number];

export const STATUS_LABELS: Record<PitchStatus, string> = {
  ACTIVE: "Hoạt động",
  MAINTENANCE: "Bảo trì",
  INACTIVE: "Ngừng hoạt động",
};

export interface Complex {
  id: number;
  name: string;
  address: string;
  district: string;
  contact: string | null;
  image: string | null;
  description: string | null;
}

export interface Amenity {
  id: number;
  name: string;
}

/** Sân kèm tên cụm sân và mã tiện ích, từ GET /api/catalog/pitches. */
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