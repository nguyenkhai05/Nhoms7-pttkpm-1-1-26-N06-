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