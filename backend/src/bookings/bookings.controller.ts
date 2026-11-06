import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { BookingsService } from './bookings.service.js';

@Controller('api/bookings')
export class BookingsController {
  constructor(private readonly service: BookingsService) {}

  @Get('services')
  async listServices(@Query('pitchId') pitchId: string) {
    return { data: await this.service.listServices(pitchId) };
  }

  @Post('holds')
  @UseGuards(JwtAuthGuard)
  async createHold(
    @Req() request: AuthenticatedRequest,
    @Body() body: {
      pitchId?: number;
      slotId?: number;
      date?: string;
      services?: Array<{ serviceId: number; quantity: number }>;
    },
  ) {
    return { data: await this.service.createHold(request.user, body) };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBooking(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return { data: await this.service.getBooking(id, request.user.id) };
  }

  @Delete(':id/hold')
  @UseGuards(JwtAuthGuard)
  async cancelHold(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return { data: await this.service.cancelHold(id, request.user.id) };
  }
}
