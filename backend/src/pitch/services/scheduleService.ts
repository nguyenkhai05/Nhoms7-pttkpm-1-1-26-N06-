import {PitchService} from './pitchService.js';
import {PitchRepository} from '../repositories/pitchRepository.js';
import {HoldStore} from '../infrastructure/holdStore.js';
import {fail} from './pitchService.js';
export function validateDate(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('Ngày không hợp lệ, dùng YYYY-MM-DD');return date;}
export class ScheduleService {
 constructor(private readonly pitchService:PitchService,private readonly repository:PitchRepository,private readonly holds:HoldStore,private readonly holidays:string[]=[]){}
 matrix(id:string|number,date:string){
 validateDate(date);const pitch=this.pitchService.detail(id),paid=this.repository.paidSlots(pitch.id,date);
 const day=new Date(date+'T00:00:00Z').getUTCDay(),dayType=this.holidays.includes(date)?'HOLIDAY':([0,6].includes(day)?'WEEKEND':'WEEKDAY');
 const slots=this.repository.slots(pitch.id).map(s=>{
 const rules=pitch.prices.filter(r=>r.dayType===dayType&&r.start<=s.start&&r.end>=s.end);
 const blocked=pitch.status!=='ACTIVE'||rules.length!==1;
 const status=blocked||paid.has(s.id)?'RED':this.holds.isHeld(pitch.id,date,s.id)?'YELLOW':'GREEN';
 return {...s,status,price:rules.length===1?rules[0].amount:null,reason:blocked?'UNAVAILABLE':paid.has(s.id)?'DEPOSIT_PAID':status==='YELLOW'?'HELD':'AVAILABLE'};
 });return {pitchId:pitch.id,date,dayType,updatedAt:new Date().toISOString(),slots};
 }
}
