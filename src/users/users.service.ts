import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { RedisService } from '../redis/redis.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private redisService: RedisService,
  ) {}

  async create(email: string, password: string, fullName: string): Promise<User> {
    const existingUser = await this.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = this.usersRepository.create({
      email,
      password: hashedPassword,
      fullName,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async createOrUpdateGoogleUser(profile: any): Promise<User> {
    const existingUser = await this.findByEmail(profile.email);
    if (existingUser) {
      return existingUser;
    }

    const user = this.usersRepository.create({
      email: profile.email,
      fullName: profile.fullName,
      picture: profile.picture,
      isGoogleUser: true,
    });

    return this.usersRepository.save(user);
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    await this.redisService.set(key, refreshToken, 7 * 24 * 60 * 60); // 7 days
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    const key = `refresh_token:${userId}`;
    return this.redisService.get(key);
  }

  async removeRefreshToken(userId: string): Promise<void> {
    const key = `refresh_token:${userId}`;
    await this.redisService.del(key);
  }
} 