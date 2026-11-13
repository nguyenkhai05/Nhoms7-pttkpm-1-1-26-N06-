import {fail} from './pitchService.js';
import {PitchService} from './pitchService.js';
import {PitchRepository} from '../repositories/pitchRepository.js';
export function validateDate(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Ngày không hợp lệ, dùng YYYY-MM-DD');return date;}
export class ScheduleService {
 constructor(private readonly pitchService:PitchService,private readonly repository:PitchRepository){}
 async matrix(id:string|number,date:string){
 validateDate(date);const pitch=await this.pitchService.detail(id);
 const [slots,occupancy,holiday,blocks]=await Promise.all([this.repository.slots(pitch.id),this.repository.occupancy(pitch.id,date),this.repository.isHoliday(date),this.repository.blocks(pitch.id,date)]);
 const states=new Map(occupancy.map(x=>[x.slotId,x.state])),day=new Date(date+'T00:00:00Z').getUTCDay(),dayType=holiday?'HOLIDAY':([0,6].includes(day)?'WEEKEND':'WEEKDAY');
 return {pitchId:pitch.id,date,dayType,updatedAt:new Date().toISOString(),slots:slots.map(s=>{
 const rules=pitch.prices.filter(r=>r.dayType===dayType&&r.start<=s.start&&r.end>=s.end);
 const blocked=pitch.status!=='ACTIVE'||rules.length!==1||blocks.some(b=>b.startsAt<`${date} ${s.end}:00`&&b.endsAt>`${date} ${s.start}:00`);
 const state=states.get(s.id),status=blocked||state==='CONFIRMED'?'RED':state==='HELD'?'YELLOW':'GREEN';
 return {...s,status,price:rules.length===1?rules[0].amount:null,reason:blocked?'UNAVAILABLE':state==='CONFIRMED'?'BOOKED':state==='HELD'?'HELD':'AVAILABLE'};
 })};
 }
}
