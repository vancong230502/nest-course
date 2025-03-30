import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config(); // Nạp biến môi trường từ file .env

const dataSource = new DataSource({
  type: process.env.DB_TYPE as any || 'mysql', // Loại cơ sở dữ liệu (MySQL)
  host: process.env.DB_HOST || 'localhost', // Địa chỉ server MySQL
  port: parseInt(process.env.DB_PORT || '3306', 10), // Cổng MySQL
  username: process.env.DB_USERNAME || 'root', // Tên người dùng MySQL
  password: process.env.DB_PASSWORD || '', // Mật khẩu MySQL
  database: process.env.DB_NAME || 'test', // Tên cơ sở dữ liệu
  entities: ['dist/**/*.entity{.ts,.js}'], // Trỏ tới các entity đã build
  migrations: ['dist/migrations/*{.ts,.js}'], // Trỏ tới các migration đã build
  synchronize: false, // Không tự đồng bộ (chỉ dùng migration)
  logging: process.env.DB_LOGGING === 'true', // Log các query (tùy chọn)
});

export default dataSource;