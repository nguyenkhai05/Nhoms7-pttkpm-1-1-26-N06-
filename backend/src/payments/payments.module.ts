import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsRepository } from './payments.repository.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsWebhookController } from './payments-webhook.controller.js';
import { PaymentsWebhookService } from './payments-webhook.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsRepository, PaymentsService, PaymentsWebhookService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
