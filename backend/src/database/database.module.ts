import { Module } from '@nestjs/common';
import { MysqlDatabase } from './mysqlDatabase.js';

/** Share a single MySQL connection pool between NestJS feature modules. */
@Module({ providers: [MysqlDatabase], exports: [MysqlDatabase] })
export class DatabaseModule {}
