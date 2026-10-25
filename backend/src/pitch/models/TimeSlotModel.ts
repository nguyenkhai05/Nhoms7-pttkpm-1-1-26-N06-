import type {DatabaseSync} from 'node:sqlite';
export class TimeSlotModel {
  static createTable(db:DatabaseSync) { db.exec(`CREATE TABLE IF NOT EXISTS slots(id INTEGER PRIMARY KEY,pitchId INTEGER NOT NULL REFERENCES pitches(id),start TEXT NOT NULL,end TEXT NOT NULL,CHECK(start<end),UNIQUE(pitchId,start,end));`); }
}
