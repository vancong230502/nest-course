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
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const { user } = req;
    const token = await this.authService.validateGoogleUser(user);
    
    // Set cookies với đầy đủ options
    res.cookie('accessToken', token.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true trong production, false trong development
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 phút
      path: '/',
      domain: '127.0.0.1'
    });

    res.cookie('refreshToken', token.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      path: '/',
      domain:'127.0.0.1'
    });

    // Chuẩn bị user data để gửi về Next.js
    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      picture: user.picture
    };

    // Chuyển hướng về Next.js với user data
    const nextUrl = `${process.env.NEXT_APP_URL}/auth/success?user=${encodeURIComponent(JSON.stringify(userData))}`;
    res.redirect(nextUrl);
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
