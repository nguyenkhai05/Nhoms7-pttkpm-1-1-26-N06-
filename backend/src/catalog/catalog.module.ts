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

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [CatalogController, CatalogPitchController, CatalogPriceController],
  providers: [CatalogRepository, CatalogService, CatalogPitchRepository, CatalogPitchService, CatalogPriceRepository, CatalogPriceService],
  exports: [CatalogService, CatalogPitchService, CatalogPriceService],
})
export class CatalogModule {}
