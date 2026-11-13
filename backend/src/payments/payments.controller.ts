import { Body, Controller, Get, Post, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('refunds')
  async listRefunds(@Query('status') status?:string) { return {data:await this.service.listRefunds(status)}; }

  @Get('my-bookings')
  async getMyBookings(@Req() req:AuthenticatedRequest) {
    return {data:await this.service.getMyBookings(req.user.id)};
  }

  @Get()
  async list(@Query('status') status?:string,@Query('method') method?:string,@Query('from') from?:string,@Query('to') to?:string) {
    return {data:await this.service.list({status,method,from,to})};
  }
  @Get(':id')
  async detail(@Param('id') id:string) { return {data:await this.service.detail(Number(id))}; }


  @Post('cash')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('PAYMENT_WRITE')
  async cash(@Req() req:AuthenticatedRequest,@Body() body:{bookingId:number;amount:number}) {
    return {data:await this.service.recordCash({bookingId:Number(body.bookingId),amount:Number(body.amount),userId:req.user.id})};
  }
  @Post(':id/refunds')
  async requestRefund(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:{amount:number;reason:string}) {
    return {data:await this.service.requestRefund(Number(id),{amount:Number(body.amount),reason:body.reason,userId:req.user.id})};
  }
  @Patch('refunds/:id/approve')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('REFUND_APPROVE')
  async approve(@Req() req:AuthenticatedRequest,@Param('id') id:string) {
    return {data:await this.service.transitionRefund(Number(id),'APPROVED',req.user.id)};
  }
  @Patch('refunds/:id/reject')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('REFUND_APPROVE')
  async reject(@Req() req:AuthenticatedRequest,@Param('id') id:string) {
    return {data:await this.service.transitionRefund(Number(id),'REJECTED',req.user.id)};
  }
  @Patch('refunds/:id/paid')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('REFUND_APPROVE')
  async paid(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:{providerReference?:string}) {
    return {data:await this.service.transitionRefund(Number(id),'PAID',req.user.id,body.providerReference)};
  }
  @Patch('refunds/:id/failed')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('REFUND_APPROVE')
  async failed(@Req() req:AuthenticatedRequest,@Param('id') id:string) {
    return {data:await this.service.transitionRefund(Number(id),'FAILED',req.user.id)};
  }
  @Post('deposit')
  async payDeposit(@Body() body:{bookingId:number;method?:'CASH'|'BANK_QR'}) {
    return {data:await this.service.payDeposit(Number(body.bookingId),body.method||'BANK_QR')};
  }
  @Post('bookings/:id/cancel')
  async cancelBooking(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:{reason:string}) {
    return {data:await this.service.cancelBooking(Number(id),body.reason,req.user.id)};
  }
}
