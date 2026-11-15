import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET chưa được cấu hình hoặc quá ngắn. Hãy tạo secret ngẫu nhiên ít nhất 32 ký tự trong backend/.env.');
  }
  if (process.env.NODE_ENV === 'production' && (!process.env.BANK_WEBHOOK_SECRET || process.env.BANK_WEBHOOK_SECRET.length < 32 || process.env.BANK_WEBHOOK_SECRET === 'demo-bank-webhook-secret-change-me-32')) {
    throw new Error('Production yêu cầu BANK_WEBHOOK_SECRET tối thiểu 32 ký tự.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_PAYMENTS_ENABLED !== 'false') {
    throw new Error('Production phải đặt DEMO_PAYMENTS_ENABLED=false để tắt thanh toán mô phỏng.');
  }
  const app = await NestFactory.create(AppModule, { rawBody: true,
    ...(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET ? {instrument: ObserveInstrument} : {}),
  });
  app.enableShutdownHooks();
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: allowedOrigins, credentials: true });
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
