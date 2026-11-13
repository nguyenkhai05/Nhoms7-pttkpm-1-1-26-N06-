// SQL schema: database/01_schema.sql. Domain model, not an ORM.
export class FootballPitchModel {
 static readonly table='pitches';
 id:number;complexId:number;name:string;type:5|7|11;grass:string;lights:string;status:string;image:string;
}
