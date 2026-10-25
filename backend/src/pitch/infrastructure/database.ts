import { DatabaseSync } from 'node:sqlite';
import { PitchComplexModel } from '../models/PitchComplexModel.js';
import { FootballPitchModel } from '../models/FootballPitchModel.js';
import { PitchPriceRuleModel } from '../models/PitchPriceRuleModel.js';
import { TimeSlotModel } from '../models/TimeSlotModel.js';
import { AmenityModel } from '../models/AmenityModel.js';
import { BookingModel } from '../models/BookingModel.js';
export function createDatabase(path=':memory:') {
 const db=new DatabaseSync(path); db.exec('PRAGMA foreign_keys=ON');
 PitchComplexModel.createTable(db); FootballPitchModel.createTable(db); PitchPriceRuleModel.createTable(db); TimeSlotModel.createTable(db); AmenityModel.createTable(db); BookingModel.createTable(db);
 return db;
}
export function seed(db:DatabaseSync,date:string) {
 if((db.prepare('SELECT COUNT(*) AS n FROM pitches').get() as {n:number}).n) return;
 db.prepare('INSERT INTO complexes VALUES(1,?,?,?,?,?)').run('Cụm sân Phenikaa','Yên Nghĩa, Hà Nội','Hà Đông','0900000000','');
 for(const [id,name,type,status] of ([[1,'Sân 7A',7,'ACTIVE'],[2,'Sân 5A',5,'ACTIVE'],[3,'Sân 11A',11,'MAINTENANCE']] as const)) {
 db.prepare('INSERT INTO pitches VALUES(?,1,?,?,?,?,?,?)').run(id,name,type,'Cỏ nhân tạo','Đèn LED',status,'');
 for(const day of ['WEEKDAY','WEEKEND','HOLIDAY']) for(const [start,end,base] of ([['06:00','17:00',200000],['17:00','22:00',350000]] as const)) db.prepare('INSERT INTO prices(pitchId,dayType,start,end,amount) VALUES(?,?,?,?,?)').run(id,day,start,end,base+(day==='WEEKDAY'?0:50000));
 for(const [start,end] of [['06:00','07:30'],['07:30','09:00'],['17:00','18:30'],['18:30','20:00'],['20:00','21:30']]) db.prepare('INSERT INTO slots(pitchId,start,end) VALUES(?,?,?)').run(id,start,end);
 }
 for(const [id,name] of [[1,'Bãi xe'],[2,'Phòng thay đồ'],[3,'Vòi tắm'],[4,'Đèn chiếu sáng']]) db.prepare('INSERT INTO amenities VALUES(?,?)').run(id,name);
 db.exec('INSERT INTO pitch_amenities VALUES(1,1),(1,2),(1,3),(1,4),(2,1),(2,4)');
 db.prepare("INSERT INTO bookings(pitchId,slotId,date,status) VALUES(1,3,?,'DEPOSIT_PAID')").run(date);
}
