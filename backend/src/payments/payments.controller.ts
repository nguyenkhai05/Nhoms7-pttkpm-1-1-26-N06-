import { Controller, Get, Inject, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { parseId } from '../catalog/dto/id.dto.js';
import { PaymentsService } from './payments.service.js';

@Controller('api/payments')
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly service: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('bookings/:id/deposit')
  async getDeposit(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return { data: await this.service.getDepositInfo(parseId(id), request.user.id) };
  }
}