import { Body, Controller, Get, Post, Put, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Res } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';
import { OperationsService } from './operations.service.js';

type RawRequest = Request & { rawBody?: Buffer };
@Controller('api')
export class OperationsController {
  constructor(private readonly ops: OperationsService) {}

  @Post('bookings/:id/cancel-preview') @UseGuards(JwtAuthGuard)
  cancelPreview(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.ops.cancelPreview(Number(id), req.user.id); }
  @Post('bookings/:id/cancel') @UseGuards(JwtAuthGuard)
  cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) { return this.ops.cancel(Number(id), body, req.user.id); }
  @Get('payments/bookings/:id/qr') @UseGuards(JwtAuthGuard)
  qr(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.ops.qr(Number(id), req.user.id); }
  @Post('payments/bookings/:id/demo-paid') @UseGuards(JwtAuthGuard)
  demoPaid(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.ops.demoPaid(Number(id), req.user.id); }
  @Post('payments/webhook/bank')
  webhook(@Req() req: RawRequest, @Body() body: any) { return this.ops.webhook(req.rawBody ?? Buffer.from(JSON.stringify(body)), body, String(req.headers['x-signature'] ?? '')); }

  @Get('schedule/matrix') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('BOOKING_WRITE')
  matrix(@Query('date') date?: string, @Query('complexId') complexId?: string) { return this.ops.matrix(date, complexId ? Number(complexId) : undefined); }
  @Post('schedule/walk-in') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('BOOKING_WRITE')
  walkIn(@Req() req: AuthenticatedRequest, @Body() body: any) { return this.ops.walkIn(body, req.user.id); }
  @Post('schedule/bookings/:id/check-in') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('BOOKING_WRITE')
  checkIn(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) { return this.ops.checkIn(Number(id), body, req.user.id); }
  @Post('schedule/bookings/:id/complete') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('BOOKING_WRITE')
  complete(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.ops.complete(Number(id), req.user.id); }

  @Get('inventory/services') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('STOCK_WRITE')
  services(@Query('complexId') id?: string) { return this.ops.services(id ? Number(id) : undefined); }
  @Get('inventory/movements') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('STOCK_WRITE')
  movements(@Query('complexId') id?: string) { return this.ops.stockMovements(id ? Number(id) : undefined); }
  @Post('inventory/services') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('STOCK_WRITE')
  addService(@Req() req: AuthenticatedRequest, @Body() body: any) { return this.ops.addService(body, req.user.id); }
  @Patch('inventory/services/:id') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('STOCK_WRITE')
  editService(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) { return this.ops.editService(Number(id), body, req.user.id); }
  @Post('inventory/receipts') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('STOCK_WRITE')
  receipt(@Req() req: AuthenticatedRequest, @Body() body: any) { return this.ops.stockMovement(body, req.user.id, 'RECEIPT'); }
  @Post('inventory/losses') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('STOCK_WRITE')
  loss(@Req() req: AuthenticatedRequest, @Body() body: any) { return this.ops.stockMovement(body, req.user.id, 'LOSS'); }

  @Get('catalog/pitches/:id/prices') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  prices(@Param('id') id: string) { return this.ops.prices(Number(id)); }
  @Put('catalog/pitches/:id/prices') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  savePrices(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) { return this.ops.savePrices(Number(id), body.prices, req.user.id); }
  @Post('catalog/pitches/:id/maintenance') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  maintenance(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) { return this.ops.maintenance(Number(id), body, req.user.id); }
  @Post('catalog/pitches/:id/maintenance/preview') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  maintenancePreview(@Param('id') id: string, @Body() body: any) { return this.ops.maintenancePreview(Number(id), body); }

  @Get('catalog/holidays') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  holidays() { return this.ops.holidays(); }
  @Post('catalog/holidays') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  addHoliday(@Req() req: AuthenticatedRequest, @Body() body: any) { return this.ops.addHoliday(body, req.user.id); }
  @Post('catalog/holidays/delete') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PITCH_WRITE')
  deleteHoliday(@Req() req: AuthenticatedRequest, @Body() body: any) { return this.ops.deleteHoliday(body.date, req.user.id); }

  @Get('reports/summary') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('REPORT_READ')
  report(@Query('from') from: string, @Query('to') to: string, @Query('groupBy') groupBy?: string) { return this.ops.report(from, to, groupBy ?? 'day'); }
  @Get('reports/export') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('REPORT_READ')
  async exportReport(@Query('from') from: string, @Query('to') to: string, @Query('groupBy') groupBy: string, @Res() res: Response) {
    const csv = await this.ops.exportCsv(from, to, groupBy || 'day');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=SportSpace-report.csv');
    res.send('\uFEFF' + csv);
  }
  @Get('audit-logs') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('AUDIT_READ')
  audit(@Query('page') page?: string, @Query('action') action?: string, @Query('actorId') actorId?: string, @Query('entityType') entityType?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.ops.listAudit({ page: page ? Number(page) : 1, action, actorId: actorId ? Number(actorId) : undefined, entityType, from, to });
  }
  @Get('payments/events') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PAYMENT_WRITE')
  events(@Query('status') status?: string) { return this.ops.events(status); }
  @Post('payments/events/:id/resolve') @UseGuards(JwtAuthGuard, PermissionsGuard) @RequirePermissions('PAYMENT_WRITE')
  resolveEvent(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: any) { return this.ops.resolveEvent(Number(id), body, req.user.id); }
}
