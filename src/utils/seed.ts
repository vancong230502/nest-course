import { DataSource, QueryRunner } from 'typeorm';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config(); // Nạp biến môi trường từ file .env

const AppDataSource = new DataSource({
    type: process.env.DB_TYPE as any || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'test',
    entities: [path.join(__dirname, '../**/*.entity{.ts,.js}')], // Load tất cả entity
    migrations: ['dist/migrations/*{.ts,.js}'],
    synchronize: false, // Không bật nếu đã có bảng
    logging: false, // Tắt logging để tăng tốc độ
});

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: npm run seed <EntityName> <RowCount>');
    process.exit(1);
}

const [entityName, rowCount] = args;
const count = parseInt(rowCount, 10);
const batchSize = 10000;

async function seed() {
    const startTime = Date.now();
    await AppDataSource.initialize();
    console.log('✅ Kết nối DB thành công!');

    const entity = AppDataSource.entityMetadatas.find(
        (e) => e.name.toLowerCase() === entityName.toLowerCase()
    );

    if (!entity) {
        console.error(`❌ Không tìm thấy entity: ${entityName}`);
        process.exit(1);
    }

    const queryRunner: QueryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        await queryRunner.query('SET FOREIGN_KEY_CHECKS=0;');
        const batches = [];
        
        for (let i = 0; i < count; i += batchSize) {
            const batch = Array.from({ length: Math.min(batchSize, count - i) }, (_, index) => {
                const record: any = {};
                entity.columns.forEach((column) => {
                    if (column.isPrimary) return;
                    if (column.propertyName === 'name') {
                        record[column.propertyName] = faker.person.fullName();
                    } else if (column.propertyName === 'email') {
                        record[column.propertyName] = faker.internet.email().replace('@', `+${i + index}@`);
                    } else if (column.propertyName === 'password') {
                        record[column.propertyName] = faker.internet.password();
                    } else if (column.type === 'int') {
                        record[column.propertyName] = faker.number.int({ min: 1, max: 100 });
                    } else if (column.type === 'text') {
                        record[column.propertyName] = faker.lorem.sentence();
                    } else if (column.type === 'boolean') {
                        record[column.propertyName] = faker.datatype.boolean();
                    } else if (column.type === 'date') {
                        record[column.propertyName] = faker.date.past();
                    } else {
                        record[column.propertyName] = faker.lorem.word();
                    }
                });
                return record;
            });
            batches.push(queryRunner.manager.insert(entity.target, batch));
        }
        
        await Promise.all(batches); // Chạy song song
        await queryRunner.query('SET FOREIGN_KEY_CHECKS=1;');
        await queryRunner.commitTransaction();
        console.log(`✅ Hoàn thành seed ${count} dòng vào bảng ${entityName}!`);
    } catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('❌ Lỗi khi seed dữ liệu:', error);
    } finally {
        await queryRunner.release();
        await AppDataSource.destroy();
        const endTime = Date.now();
        console.log(`⏱ Tổng thời gian thực thi: ${(endTime - startTime) / 1000} giây`);
    }
    process.exit();
}

seed().catch((error) => {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    process.exit(1);
});
