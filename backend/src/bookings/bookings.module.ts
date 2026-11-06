import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsRepository } from './bookings.repository.js';
import { BookingsService } from './bookings.service.js';
import { RedisLockService } from './redis-lock.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [BookingsController],
  providers: [BookingsRepository, BookingsService, RedisLockService],
  exports: [BookingsService],
})
export class BookingsModule {}
