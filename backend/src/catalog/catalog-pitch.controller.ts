import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CatalogPitchService } from './catalog-pitch.service.js';
import { parseId } from './dto/id.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/catalog')
export class CatalogPitchController {
  constructor(@Inject(CatalogPitchService) private readonly service: CatalogPitchService) {}

  @Get('amenities')
  async listAmenities() {
    return { data: await this.service.listAmenities() };
  }

  @Get('pitches')
  async listPitches(@Query('complexId') complexId?: string) {
    const id = complexId === undefined ? undefined : parseId(complexId, 'complexId');
    return { data: await this.service.listPitches(id) };
  }

  @Get('pitches/:id')
  async getPitch(@Param('id') id: string) {
    return { data: await this.service.getPitch(parseId(id)) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Post('pitches')
  async createPitch(@Body() body: unknown) {
    return { data: await this.service.createPitch(body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Patch('pitches/:id')
  async updatePitch(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.updatePitch(parseId(id), body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Delete('pitches/:id')
  async deletePitch(@Param('id') id: string) {
    return { data: await this.service.deletePitch(parseId(id)) };
  }
}