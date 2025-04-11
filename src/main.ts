// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser'; // 👈 sửa lại như sau

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser()); // ✅ chạy được

  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  });
  
  

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
