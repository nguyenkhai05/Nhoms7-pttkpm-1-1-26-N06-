import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogPitchService } from './catalog-pitch.service.js';
import { parseId } from './dto/id.dto.js';

// TODO(auth): các route ghi (POST, PATCH, DELETE) cần guard yêu cầu quyền PITCH_WRITE
// (ADMIN, MANAGER). Gắn khi backend đăng nhập (#5) hoàn thành.
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

  @Post('pitches')
  async createPitch(@Body() body: unknown) {
    return { data: await this.service.createPitch(body) };
  }

  @Patch('pitches/:id')
  async updatePitch(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.updatePitch(parseId(id), body) };
  }

  @Delete('pitches/:id')
  async deletePitch(@Param('id') id: string) {
    return { data: await this.service.deletePitch(parseId(id)) };
  }
}