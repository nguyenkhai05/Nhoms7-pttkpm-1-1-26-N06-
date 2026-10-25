import {createPool} from 'mysql2/promise';
import type {Pool,RowDataPacket} from 'mysql2/promise';
import type {OnModuleDestroy,OnModuleInit} from '@nestjs/common';
export class MysqlDatabase implements OnModuleInit,OnModuleDestroy {
 readonly pool:Pool;
 constructor(){this.pool=createPool({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'football_app',password:process.env.DB_PASSWORD||'',database:process.env.DB_NAME||'football_management',waitForConnections:true,connectionLimit:10,dateStrings:true,decimalNumbers:true,charset:'utf8mb4',timezone:'Z'});}
 async onModuleInit(){await this.pool.query('SELECT 1');}
 async onModuleDestroy(){await this.pool.end();}
 async rows<T>(sql:string,args:(string|number)[]=[]):Promise<T[]>{const [rows]=await this.pool.execute<RowDataPacket[]>(sql,args);return rows as unknown as T[];}
}
