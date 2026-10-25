export interface Amenity {id:number;name:string}
export interface PriceRule {id:number;pitchId:number;dayType:string;start:string;end:string;amount:number}
export interface Pitch {id:number;complexId:number;name:string;type:number;grass:string;lights:string;status:string;image:string;complexName:string;district:string;address:string;contact?:string;startingPrice?:number;amenities:Amenity[];prices:PriceRule[]}
export interface Slot {id:number;pitchId:number;start:string;end:string}
export interface SearchFilter {type:number|null;district:string;minPrice:number;maxPrice:number;amenities:number[]}
export type SearchQuery=Record<string,string|undefined>;
