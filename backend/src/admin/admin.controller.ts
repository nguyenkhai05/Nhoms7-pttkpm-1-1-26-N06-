import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';
import { AdminService } from './admin.service.js';

@Controller('api/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('users')
  @RequirePermissions('USER_WRITE')
  async users() { return { data: await this.service.users() }; }

  @Post('users')
  @RequirePermissions('USER_WRITE')
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return { data: await this.service.create(request.user.id, request.ip, body) };
  }

  @Patch('users/:id')
  @RequirePermissions('USER_WRITE')
  async update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return { data: await this.service.update(request.user.id, request.ip, id, body) };
  }

  @Get('audit-logs')
  @RequirePermissions('AUDIT_READ')
  async audit(@Query() query: Record<string, string>) {
    return { data: await this.service.audit(query) };
  }
}
