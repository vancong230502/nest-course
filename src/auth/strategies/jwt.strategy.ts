import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: JwtStrategy.extractToken,
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true, // Cho phép truyền req vào validate()
    });
  }

  // Ưu tiên đọc accessToken từ cookie -> fallback sang Bearer token
  private static extractToken(req: Request): string | null {
    if (req.cookies?.accessToken) {
      return req.cookies.accessToken;
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    return null;
  }

  // Validate token sau khi decode payload
  async validate(req: Request, payload: any): Promise<any> {
    const token = JwtStrategy.extractToken(req);
    if (!token) {
      throw new UnauthorizedException('Access token not found');
    }

    // 1. Check blacklist
    const isBlacklisted = await this.redisService.isAccessTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 2. Check device ID nếu có logic login thiết bị
    const storedDeviceId = await this.redisService.getDeviceId(payload.sub);
    if (!storedDeviceId || storedDeviceId !== payload.deviceId) {
      throw new UnauthorizedException('Invalid access token or logged in on another device');
    }

    // 3. Trả thông tin user
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
