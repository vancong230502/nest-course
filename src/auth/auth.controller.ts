import { Controller, Post, Body, Get, UseGuards, Req, HttpCode, HttpStatus, Query, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('google')
  async googleAuth(@Res() res: Response): Promise<void> {
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?response_type=code` +
      `&access_type=offline` +  // Yêu cầu refresh_token
      `&prompt=consent` +       // Buộc hiển thị hộp thoại cấp quyền
      `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALL_BACK)}` +
      `&scope=${encodeURIComponent('email profile')}` +
      `&client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}`
  
    res.redirect(redirectUrl);
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any) {
    const { user } = req;
    console.log(user);
    return this.authService.validateGoogleUser(user);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request) {
    await this.authService.logout((req.user as any).id, req.headers.authorization.split(' ')[1]);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.user;
  }
}
