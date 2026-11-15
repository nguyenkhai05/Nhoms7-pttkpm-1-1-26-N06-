import { BadRequestException, Body, Controller, Get, Post, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard, type AuthenticatedRequest } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/guards/permissions.decorator.js';

@Controller('api/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  @Get('refunds')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('REFUND_APPROVE')
  async listRefunds(@Query('status') status?:string) { return {data:await this.service.listRefunds(status)}; }

  @Get('my-bookings')
  async getMyBookings(@Req() req:AuthenticatedRequest) {
    return {data:await this.service.getMyBookings(req.user.id)};
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('PAYMENT_WRITE')
  async list(@Query('status') status?:string,@Query('method') method?:string,@Query('from') from?:string,@Query('to') to?:string) {
    return {data:await this.service.list({status,method,from,to})};
  }
  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('PAYMENT_WRITE')
  async detail(@Param('id') id:string) { return {data:await this.service.detail(Number(id))}; }


  @Post('cash')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('PAYMENT_WRITE')
  async cash(@Req() req:AuthenticatedRequest,@Body() body:{bookingId:number;amount:number}) {
    const bookingId = Number(body.bookingId);
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(bookingId) || bookingId < 1 || !Number.isSafeInteger(amount) || amount < 1) {
      throw new BadRequestException('Mã đơn và số tiền phải là số nguyên dương.');
    }
    return {data:await this.service.recordCash({bookingId,amount,userId:req.user.id})};
  }
  @Post(':id/refunds')
  async requestRefund(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:{amount:number;reason:string}) {
    return {data:await this.service.requestRefund(Number(id),{amount:Number(body.amount),reason:body.reason,userId:req.user.id,canManage:req.user.permissions.includes('REFUND_APPROVE')})};
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
  async reject(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Body() body:{reason:string}) {
    if(!body.reason?.trim()) throw new BadRequestException('Vui lòng nhập lý do từ chối.');
    return {data:await this.service.transitionRefund(Number(id),'REJECTED',req.user.id,undefined,body.reason.trim())};
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

}
