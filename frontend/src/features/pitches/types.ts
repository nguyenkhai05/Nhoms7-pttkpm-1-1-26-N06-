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
  startingPrice: number;
}
export interface Selection {
  pitchId: number;
  date: string;
  slotId: number;
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
