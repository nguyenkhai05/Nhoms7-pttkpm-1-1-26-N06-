import {MysqlDatabase} from '../infrastructure/mysqlDatabase.js';
import type {Pitch,Amenity,PriceRule,Slot,SearchFilter} from '../types.js';
export class PitchRepository {
 constructor(private readonly db:MysqlDatabase){}
 async search(f:SearchFilter){
 const clauses=["p.status='ACTIVE'"],args:(string|number)[]=[];
 if(f.type){clauses.push('p.type=?');args.push(f.type);}
 if(f.district){clauses.push('c.district LIKE ?');args.push('%'+f.district+'%');}
 for(const id of f.amenities){clauses.push('EXISTS(SELECT 1 FROM pitch_amenities a WHERE a.pitchId=p.id AND a.amenityId=?)');args.push(id);}
 clauses.push('EXISTS(SELECT 1 FROM prices r WHERE r.pitchId=p.id AND r.amount>=? AND r.amount<=?)');args.push(f.minPrice,f.maxPrice);
 const rows=await this.db.rows<Pitch>(`SELECT p.*,c.district,c.address,c.name AS complexName,(SELECT MIN(amount) FROM prices WHERE pitchId=p.id) AS startingPrice FROM pitches p JOIN complexes c ON c.id=p.complexId WHERE ${clauses.join(' AND ')} ORDER BY p.id`,args);
 return Promise.all(rows.map(async x=>({...x,amenities:await this.amenities(x.id)})));
 }
 amenities(id:number){return this.db.rows<Amenity>('SELECT a.* FROM amenities a JOIN pitch_amenities pa ON pa.amenityId=a.id WHERE pa.pitchId=?',[id]);}
 async detail(id:number):Promise<Pitch|null>{const [x]=await this.db.rows<Pitch>('SELECT p.*,c.name AS complexName,c.address,c.district,c.contact FROM pitches p JOIN complexes c ON c.id=p.complexId WHERE p.id=?',[id]);if(!x)return null;const [amenities,prices]=await Promise.all([this.amenities(id),this.db.rows<PriceRule>('SELECT * FROM prices WHERE pitchId=? ORDER BY dayType,`start`',[id])]);return {...x,amenities,prices};}
 slots(id:number){return this.db.rows<Slot>('SELECT * FROM slots WHERE pitchId=? ORDER BY `start`',[id]);}
 async occupancy(id:number,date:string){return this.db.rows<{slotId:number;state:string}>("SELECT slotId,state FROM slot_occupancy WHERE pitchId=? AND date=? AND (state='CONFIRMED' OR expiresAt>UTC_TIMESTAMP())",[id,date]);}
 async isHoliday(date:string){return (await this.db.rows('SELECT date FROM holidays WHERE date=?',[date])).length>0;}
 blocks(id:number,date:string){return this.db.rows<{startsAt:string;endsAt:string}>('SELECT startsAt,endsAt FROM pitch_blocks WHERE pitchId=? AND startsAt<DATE_ADD(?,INTERVAL 1 DAY) AND endsAt>?',[id,date,date]);}
}
