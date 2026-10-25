import {HttpException} from '@nestjs/common';
import {PitchRepository} from '../repositories/pitchRepository.js';
import type {SearchQuery} from '../types.js';
export function fail(message:string,status=400):never{throw new HttpException(message,status);}
export function positiveId(value:unknown){if(!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1)fail('Mã không hợp lệ');return Number(value);}
export class PitchService {
 constructor(private readonly repository:PitchRepository){}
 search(q:SearchQuery){
 const type=q.type?Number(q.type):null;if(type!==null&&![5,7,11].includes(type))fail('Loại sân phải là 5, 7 hoặc 11');
 const minPrice=q.minPrice?Number(q.minPrice):0,maxPrice=q.maxPrice?Number(q.maxPrice):Number.MAX_SAFE_INTEGER;
 if(!Number.isFinite(minPrice)||!Number.isFinite(maxPrice)||minPrice<0||maxPrice<minPrice)fail('Khoảng giá không hợp lệ');
 const amenities=q.amenities?String(q.amenities).split(',').map(positiveId):[];
 return this.repository.search({type,minPrice,maxPrice,district:String(q.district||'').trim(),amenities});
 }
 detail(id:string|number){const x=this.repository.detail(positiveId(id));if(!x)fail('Không tìm thấy sân',404);return x;}
}
