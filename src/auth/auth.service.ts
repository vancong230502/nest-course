import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, fullName } = registerDto;
    const user = await this.usersService.create(email, password, fullName);

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.usersService.validatePassword(user, password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    console.log(user);
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        picture: user.picture,
        role: user.role
      },
      ...tokens,
    };
  }

  async refind(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        picture: user.picture,
        role: user.role
      },
      ...tokens,
    };
  }

  async validateGoogleUser(profile: any) {
    const user = await this.usersService.createOrUpdateGoogleUser(profile);
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        picture: user.picture,
        role: user.role
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check refresh token in Redis
      const storedRefreshToken = await this.redisService.getRefreshToken(user.id);
      if (!storedRefreshToken || storedRefreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token or logged in on another device');
      }

      const tokens = await this.generateTokens(user);
      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token or logged in on another device');
    }
  }

  async logout(userId: string, accessToken: string): Promise<void> {
    // Remove refresh token and device ID
    await Promise.all([
      this.redisService.removeRefreshToken(userId),
      this.redisService.removeDeviceId(userId),
    ]);

    // Add access token to blacklist
    const payload = this.jwtService.decode(accessToken) as any;
    const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
    await this.redisService.addToAccessTokenBlacklist(accessToken, expiresIn);
  }

  private async generateTokens(user: any) {
    const deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
  
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      deviceId,
    };
  
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION'),
      }),
    ]);
  
    const refreshTokenExpiration = this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION', '7d');
    const ttl = this.parseExpirationToSeconds(refreshTokenExpiration);
  
    await Promise.all([
      this.redisService.removeRefreshToken(user.id),
      this.redisService.removeDeviceId(user.id),
    ]);
  
    await Promise.all([
      this.redisService.setRefreshToken(user.id, refreshToken, ttl),
      this.redisService.setDeviceId(user.id, deviceId, ttl),
    ]);
  
    return {
      accessToken,
      refreshToken,
    };
  }
  
  private parseExpirationToSeconds(expiration: string): number {
    const value = parseInt(expiration);
    const unit = expiration.slice(-1);
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 7 * 24 * 60 * 60; // Default to 7 days
    }
  }
}
