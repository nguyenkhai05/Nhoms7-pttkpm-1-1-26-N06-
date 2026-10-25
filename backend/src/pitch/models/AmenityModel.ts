import type {DatabaseSync} from 'node:sqlite';
export class AmenityModel {
  static createTable(db:DatabaseSync) { db.exec(`CREATE TABLE IF NOT EXISTS amenities(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE); CREATE TABLE IF NOT EXISTS pitch_amenities(pitchId INTEGER REFERENCES pitches(id),amenityId INTEGER REFERENCES amenities(id),PRIMARY KEY(pitchId,amenityId));`); }
}
