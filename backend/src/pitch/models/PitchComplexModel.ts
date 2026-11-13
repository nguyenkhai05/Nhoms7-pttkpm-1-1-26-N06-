// SQL schema: database/01_schema.sql. Domain model, not an ORM.
export class PitchComplexModel {
 static readonly table='complexes';
 id:number;name:string;address:string;district:string;contact:string;image:string;
}
