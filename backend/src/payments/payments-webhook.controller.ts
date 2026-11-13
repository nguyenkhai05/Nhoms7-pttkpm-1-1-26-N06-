import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import { PaymentsWebhookService } from './payments-webhook.service.js';

/** Không dùng JwtAuthGuard: người gọi là nhà cung cấp thanh toán, xác thực bằng chữ ký. */
@Controller('api/payments')
export class PaymentsWebhookController {
  constructor(@Inject(PaymentsWebhookService) private readonly service: PaymentsWebhookService) {}

  @Post('webhook')
  @HttpCode(200)
  async receive(@Body() body: unknown, @Headers('x-signature') signature?: string) {
    return { data: await this.service.handle(body, signature) };
  }
}