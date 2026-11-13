import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogPitchController } from './catalog-pitch.controller.js';
import { CatalogPitchRepository } from './catalog-pitch.repository.js';
import { CatalogPitchService } from './catalog-pitch.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import { CatalogPriceRepository } from './catalog-price.repository.js';
import { CatalogPriceService } from './catalog-price.service.js';
import { CatalogPriceController } from './catalog-price.controller.js';
import { CatalogHolidayController } from './catalog-holiday.controller.js';
import { CatalogHolidayRepository } from './catalog-holiday.repository.js';
import { CatalogHolidayService } from './catalog-holiday.service.js';
import { CatalogSlotController } from './catalog-slot.controller.js';
import { CatalogSlotRepository } from './catalog-slot.repository.js';
import { CatalogSlotService } from './catalog-slot.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [
    CatalogController,
    CatalogPitchController,
    CatalogPriceController,
    CatalogHolidayController,
    CatalogSlotController,
  ],
  providers: [
    CatalogRepository,
    CatalogService,
    CatalogPitchRepository,
    CatalogPitchService,
    CatalogPriceRepository,
    CatalogPriceService,
    CatalogHolidayRepository,
    CatalogHolidayService,
    CatalogSlotRepository,
    CatalogSlotService,
  ],
  exports: [CatalogService, CatalogPitchService, CatalogPriceService, CatalogHolidayService, CatalogSlotService],
})
export class CatalogModule {}