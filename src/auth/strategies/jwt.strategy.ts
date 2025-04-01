import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET_KEY'),
    });
  }

  async validate(payload: any, token: string) {
    // Check if token is blacklisted
    const isBlacklisted = await this.redisService.isAccessTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Check if device ID matches
    const storedDeviceId = await this.redisService.getDeviceId(payload.sub);
    if (!storedDeviceId || storedDeviceId !== payload.deviceId) {
      throw new UnauthorizedException('Invalid access token or logged in on another device');
    }

    return { 
      id: payload.sub, 
      email: payload.email,
      role: payload.role,
    };
  }
} 