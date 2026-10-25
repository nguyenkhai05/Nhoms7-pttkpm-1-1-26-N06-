import type {DatabaseSync} from 'node:sqlite';
import type {Pitch,Amenity,PriceRule,Slot,SearchFilter} from '../types.js';
export class PitchRepository {
 constructor(private readonly db:DatabaseSync){}
 search(f:SearchFilter){
 const clauses=["p.status='ACTIVE'"],args:(string|number)[]=[];
 if(f.type){clauses.push('p.type=?');args.push(f.type);}
 if(f.district){clauses.push('c.district LIKE ?');args.push('%'+f.district+'%');}
 for(const id of f.amenities){clauses.push('EXISTS(SELECT 1 FROM pitch_amenities a WHERE a.pitchId=p.id AND a.amenityId=?)');args.push(id);}
 clauses.push('EXISTS(SELECT 1 FROM prices r WHERE r.pitchId=p.id AND r.amount>=? AND r.amount<=?)');args.push(f.minPrice,f.maxPrice);
 return this.db.prepare(`SELECT p.*,c.district,c.address,c.name AS complexName,(SELECT MIN(amount) FROM prices WHERE pitchId=p.id) AS startingPrice FROM pitches p JOIN complexes c ON c.id=p.complexId WHERE ${clauses.join(' AND ')} ORDER BY p.id`).all(...args).map(row=>{const x=row as unknown as Pitch;return {...x,amenities:this.amenities(x.id)};});
 }
 amenities(id:number):Amenity[]{return this.db.prepare('SELECT a.* FROM amenities a JOIN pitch_amenities pa ON pa.amenityId=a.id WHERE pa.pitchId=?').all(id) as unknown as Amenity[];}
 detail(id:number):Pitch|null{const x=this.db.prepare('SELECT p.*,c.name AS complexName,c.address,c.district,c.contact FROM pitches p JOIN complexes c ON c.id=p.complexId WHERE p.id=?').get(id) as unknown as Pitch|undefined;return x?{...x,amenities:this.amenities(id),prices:this.db.prepare('SELECT * FROM prices WHERE pitchId=? ORDER BY dayType,start').all(id) as unknown as PriceRule[]}:null;}
 slots(id:number):Slot[]{return this.db.prepare('SELECT * FROM slots WHERE pitchId=? ORDER BY start').all(id) as unknown as Slot[];}
 paidSlots(id:number,date:string){return new Set(this.db.prepare("SELECT slotId FROM bookings WHERE pitchId=? AND date=? AND status IN ('DEPOSIT_PAID','COMPLETED')").all(id,date).map(x=>Number(x.slotId)));}
}
