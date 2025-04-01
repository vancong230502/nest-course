import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService {
  private readonly redisClient: Redis;
  private readonly refreshTokenPrefix = 'refresh_token:';
  private readonly accessTokenBlacklistPrefix = 'access_token_blacklist:';
  private readonly deviceIdPrefix = 'device_id:';

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST'),
      port: this.configService.get<number>('REDIS_PORT'),
      password: this.configService.get<string>('REDIS_PASSWORD'),
    });
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redisClient.set(key, value, 'EX', ttl);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async del(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.redisClient.exists(key);
    return result === 1;
  }

  async setRefreshToken(userId: string, token: string, ttl: number): Promise<void> {
    await this.redisClient.set(
      `${this.refreshTokenPrefix}${userId}`,
      token,
      'EX',
      ttl,
    );
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.redisClient.get(`${this.refreshTokenPrefix}${userId}`);
  }

  async removeRefreshToken(userId: string): Promise<void> {
    await this.redisClient.del(`${this.refreshTokenPrefix}${userId}`);
  }

  async setDeviceId(userId: string, deviceId: string, ttl: number): Promise<void> {
    await this.redisClient.set(
      `${this.deviceIdPrefix}${userId}`,
      deviceId,
      'EX',
      ttl,
    );
  }

  async getDeviceId(userId: string): Promise<string | null> {
    return this.redisClient.get(`${this.deviceIdPrefix}${userId}`);
  }

  async removeDeviceId(userId: string): Promise<void> {
    await this.redisClient.del(`${this.deviceIdPrefix}${userId}`);
  }

  async addToAccessTokenBlacklist(token: string, ttl: number): Promise<void> {
    await this.redisClient.set(
      `${this.accessTokenBlacklistPrefix}${token}`,
      '1',
      'EX',
      ttl,
    );
  }

  async isAccessTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redisClient.get(`${this.accessTokenBlacklistPrefix}${token}`);
    return result !== null;
  }
} 