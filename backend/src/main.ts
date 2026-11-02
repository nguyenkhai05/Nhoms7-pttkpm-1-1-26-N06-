import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    ...(process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET ? {instrument: ObserveInstrument} : {}),
  });
  app.enableShutdownHooks();
  app.enableCors(); // <-- Thêm dòng này vào đây
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
