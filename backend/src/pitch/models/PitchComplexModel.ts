import type {DatabaseSync} from 'node:sqlite';
export class PitchComplexModel {
  static createTable(db:DatabaseSync) { db.exec(`CREATE TABLE IF NOT EXISTS complexes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,address TEXT NOT NULL,district TEXT NOT NULL,contact TEXT,image TEXT);`); }
}
