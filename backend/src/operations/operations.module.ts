import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { OperationsController } from './operations.controller.js';
import { OperationsService } from './operations.service.js';
@Module({ imports: [DatabaseModule, AuthModule, BookingsModule], controllers: [OperationsController], providers: [OperationsService] })
export class OperationsModule {}
