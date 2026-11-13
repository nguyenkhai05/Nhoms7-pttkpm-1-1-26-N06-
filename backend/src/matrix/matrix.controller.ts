import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { MatrixService } from './matrix.service.js';

@Controller('matrix')
export class MatrixController {
  constructor(private readonly service: MatrixService) {}

  // API lấy dữ liệu ma trận theo ngày (mặc định là hôm nay nếu không truyền)
  @Get('data')
  async getMatrixData(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.service.getMatrixData(targetDate);
  }

  // API tạo đơn đặt sân trực tiếp tại quầy
  @Post('walk-in')
  async createWalkInBooking(
    @Body() body: { pitchId: number; slotId: number; date: string; guestName: string; guestPhone: string; totalAmount: number }
  ) {
    return this.service.createWalkInBooking(body);
  }

  // API Check-in (xác nhận khách đã đến sân)
  @Post('check-in/:id')
  async checkInBooking(@Param('id') id: string) {
    return this.service.checkInBooking(Number(id));
  }
}