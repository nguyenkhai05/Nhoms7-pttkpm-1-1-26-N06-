import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { parseId } from './dto/id.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/catalog')
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly service: CatalogService) {}

  @Get('complexes')
  async listComplexes() {
    return { data: await this.service.listComplexes() };
  }

  @Get('complexes/:id')
  async getComplex(@Param('id') id: string) {
    return { data: await this.service.getComplex(parseId(id)) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Post('complexes')
  async createComplex(@Body() body: unknown) {
    return { data: await this.service.createComplex(body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Patch('complexes/:id')
  async updateComplex(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.updateComplex(parseId(id), body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Delete('complexes/:id')
  async deleteComplex(@Param('id') id: string) {
    return { data: await this.service.deleteComplex(parseId(id)) };
  }
}