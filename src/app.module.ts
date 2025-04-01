import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import dataSource from './utils/typeorm';
import * as dotenv from 'dotenv';

dotenv.config(); // Nạp biến môi trường từ file .env

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Biến môi trường dùng toàn hệ thống
    }),
    TypeOrmModule.forRoot({
      ...dataSource.options, // Kết nối database
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
