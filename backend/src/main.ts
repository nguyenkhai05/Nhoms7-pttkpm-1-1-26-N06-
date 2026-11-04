import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET chưa được cấu hình hoặc quá ngắn. Hãy tạo secret ngẫu nhiên ít nhất 32 ký tự trong backend/.env.');
  }
  const app = await NestFactory.create(AppModule, {
    ...(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET ? {instrument: ObserveInstrument} : {}),
  });
  app.enableShutdownHooks();
  app.enableCors(); // <-- Thêm dòng này vào đây
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
