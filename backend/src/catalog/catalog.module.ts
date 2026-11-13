import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CatalogPitchController } from './catalog-pitch.controller.js';
import { CatalogPitchRepository } from './catalog-pitch.repository.js';
import { CatalogPitchService } from './catalog-pitch.service.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController, CatalogPitchController],
  providers: [CatalogRepository, CatalogService, CatalogPitchRepository, CatalogPitchService],
  exports: [CatalogService, CatalogPitchService],
})
export class CatalogModule {}