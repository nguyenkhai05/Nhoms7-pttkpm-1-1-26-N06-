// SQL schema: database/01_schema.sql. Domain model, not an ORM.
export class TimeSlotModel {
 static readonly table='slots';
 id:number;pitchId:number;start:string;end:string;
}
