import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogPriceService } from './catalog-price.service.js';
import { parseId } from './dto/id.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/catalog/prices')
export class CatalogPriceController {
  constructor(@Inject(CatalogPriceService) private readonly service: CatalogPriceService) {}

  @Get()
  async list() { return { data: await this.service.list() }; }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Post()
  async create(@Body() body: unknown) { return { data: await this.service.create(body) }; }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.update(parseId(id), body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Delete(':id')
  async delete(@Param('id') id: string) { return { data: await this.service.delete(parseId(id)) }; }
}
