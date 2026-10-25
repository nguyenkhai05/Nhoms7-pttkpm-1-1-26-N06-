import type {DatabaseSync} from 'node:sqlite';
export class FootballPitchModel {
  static createTable(db:DatabaseSync) { db.exec(`CREATE TABLE IF NOT EXISTS pitches(id INTEGER PRIMARY KEY,complexId INTEGER NOT NULL REFERENCES complexes(id),name TEXT NOT NULL,type INTEGER NOT NULL CHECK(type IN (5,7,11)),grass TEXT,lights TEXT,status TEXT NOT NULL CHECK(status IN ('ACTIVE','MAINTENANCE')),image TEXT);`); }
}
