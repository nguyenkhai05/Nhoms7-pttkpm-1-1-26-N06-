export interface Amenity {
  id: number;
  name: string;
}
export interface PriceRule {
  id: number;
  dayType: string;
  start: string;
  end: string;
  amount: number;
}
export interface Pitch {
  id: number;
  complexId: number;
  name: string;
  type: number;
  complexName: string;
  district: string;
  address: string;
  grass: string;
  lights: string;
  image: string;
  amenities: Amenity[];
  prices: PriceRule[];
  startingPrice: number | null;
}
export interface Selection {
  pitchId: number;
  date: string;
  slotId: number;
  start?: string;
  end?: string;
  price?: number | null;
}
export interface Slot {
  id: number;
  start: string;
  end: string;
  status: "GREEN" | "YELLOW" | "RED";
  price: number | null;
  reason: string;
}
export interface Matrix {
  pitchId: number;
  date: string;
  slots: Slot[];
  updatedAt: string;
}
