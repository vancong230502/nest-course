import * as mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();

async function createDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  const databaseName = process.env.DB_NAME || 'test';

  try {
    // Kiểm tra và tạo database nếu chưa tồn tại
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\``);
    console.log(`Database "${databaseName}" checked/created successfully.`);
  } catch (error) {
    console.error(`Error creating database:`, error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Gọi hàm tạo database
createDatabase();