import type {DatabaseSync} from 'node:sqlite';
export class PitchPriceRuleModel {
  static createTable(db:DatabaseSync) { db.exec(`CREATE TABLE IF NOT EXISTS prices(id INTEGER PRIMARY KEY,pitchId INTEGER NOT NULL REFERENCES pitches(id),dayType TEXT NOT NULL CHECK(dayType IN ('WEEKDAY','WEEKEND','HOLIDAY')),start TEXT NOT NULL,end TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount>0),CHECK(start<end),UNIQUE(pitchId,dayType,start,end));`); }
}
