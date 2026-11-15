import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';
import { AdminService } from './admin.service.js';

@Controller('api/admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('USER_WRITE')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get()
  async list(@Query('q') q?: string, @Query('page') page?: string) {
    return { data: await this.service.list(q ?? '', page === undefined ? 1 : Number(page)) };
  }

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return { data: await this.service.create(body, req.user.id) };
  }

  @Patch(':id')
  async update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.update(Number(id), body, req.user.id) };
  }
}
