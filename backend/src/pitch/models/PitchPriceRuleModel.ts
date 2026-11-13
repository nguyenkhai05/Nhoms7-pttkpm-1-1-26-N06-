// SQL schema: database/01_schema.sql. Domain model, not an ORM.
export class PitchPriceRuleModel {
 static readonly table='prices';
 id:number;pitchId:number;dayType:string;start:string;end:string;amount:number;depositPercent:number;
}
