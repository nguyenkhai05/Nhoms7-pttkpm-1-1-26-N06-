import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { parseId } from './dto/id.dto.js';

// TODO(auth): các route ghi (POST, PATCH, DELETE) cần guard yêu cầu quyền PITCH_WRITE
// (ADMIN, MANAGER). Gắn khi backend đăng nhập (#5) hoàn thành.
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

  @Post('complexes')
  async createComplex(@Body() body: unknown) {
    return { data: await this.service.createComplex(body) };
  }

  @Patch('complexes/:id')
  async updateComplex(@Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.updateComplex(parseId(id), body) };
  }

  @Delete('complexes/:id')
  async deleteComplex(@Param('id') id: string) {
    return { data: await this.service.deleteComplex(parseId(id)) };
  }
}