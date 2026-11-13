import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { CatalogHolidayService } from './catalog-holiday.service.js';
import { parseDate } from './dto/holiday.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/catalog/holidays')
export class CatalogHolidayController {
  constructor(@Inject(CatalogHolidayService) private readonly service: CatalogHolidayService) {}

  @Get()
  async listHolidays() {
    return { data: await this.service.listHolidays() };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Post()
  async createHoliday(@Body() body: unknown) {
    return { data: await this.service.createHoliday(body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Delete(':date')
  async deleteHoliday(@Param('date') date: string) {
    return { data: await this.service.deleteHoliday(parseDate(date)) };
  }
}