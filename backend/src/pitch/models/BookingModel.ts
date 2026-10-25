// SQL schema: database/01_schema.sql. Domain model, not an ORM.
export class BookingModel {
 static readonly table='bookings';
 id:number;code:string;pitchId:number;slotId:number;date:string;customerId:number|null;status:string;pitchAmount:number;depositDue:number;expiresAt:string|null;
}
