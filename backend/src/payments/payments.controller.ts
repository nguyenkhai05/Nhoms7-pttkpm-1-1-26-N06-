import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Post('deposit')
  async payDeposit(@Body() body: { bookingId: number; method?: 'CASH' | 'BANK_QR' }) {
    return this.service.payDeposit(Number(body.bookingId), body.method || 'BANK_QR');
  }

  @Get('my-bookings')
  async getMyBookings(@Query('customerId') customerId: string) {
    return this.service.getMyBookings(Number(customerId));
  }

  @Post('bookings/:id/cancel')
  async cancelBooking(@Param('id') id: string, @Body() body: { reason: string; userId?: number }) {
    return this.service.cancelBooking(Number(id), body.reason, body.userId || null);
  }
}