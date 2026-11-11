import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';
import { ReportsService } from './reports.service.js';

@Controller('api/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('REPORT_READ')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('summary')
  async summary(@Query('from') from?: string, @Query('to') to?: string) {
    return { data: await this.service.summary(from, to) };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@Res() response: Response, @Query('from') from?: string, @Query('to') to?: string) {
    const report = await this.service.summary(from, to);
    const lines = [
      'Ngày,Tiền sân,Tiền dịch vụ,Tiền hoàn,Thực thu',
      ...report.daily.map((day) => [day.date, day.pitch, day.service, day.refunded, day.net].join(',')),
      `Tổng,${report.pitchCollected},${report.serviceCollected},${report.refunded},${report.netCollected}`,
    ];
    response.setHeader('Content-Disposition', `attachment; filename="report-${report.from}-${report.to}.csv"`);
    response.send('\uFEFF' + lines.join('\r\n'));
  }
}
