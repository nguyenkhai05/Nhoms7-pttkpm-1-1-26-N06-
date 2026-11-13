import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { CatalogSlotService } from './catalog-slot.service.js';
import { parseId } from './dto/id.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/catalog/pitches')
export class CatalogSlotController {
  constructor(@Inject(CatalogSlotService) private readonly service: CatalogSlotService) {}

  @Get(':id/slots')
  async listSlots(@Param('id') id: string) {
    return { data: await this.service.listSlots(parseId(id)) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Post(':id/slots')
  async createSlot(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.createSlot(parseId(id), body) };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('PITCH_WRITE')
  @Delete(':id/slots/:slotId')
  async deleteSlot(@Param('id') id: string, @Param('slotId') slotId: string) {
    return { data: await this.service.deleteSlot(parseId(id), parseId(slotId, 'slotId')) };
  }
}