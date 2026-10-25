import type {DatabaseSync} from 'node:sqlite';
export class BookingModel {
  static createTable(db:DatabaseSync) { db.exec(`CREATE TABLE IF NOT EXISTS bookings(id INTEGER PRIMARY KEY,pitchId INTEGER NOT NULL REFERENCES pitches(id),slotId INTEGER NOT NULL REFERENCES slots(id),date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('DEPOSIT_PAID','COMPLETED','CANCELLED'))); CREATE UNIQUE INDEX IF NOT EXISTS one_paid_booking ON bookings(pitchId,slotId,date) WHERE status IN ('DEPOSIT_PAID','COMPLETED');`); }
}
