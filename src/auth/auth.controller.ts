import { 
  Controller, Post, Body, Get, UseGuards, Req, Res, HttpCode, HttpStatus, 
  HttpException
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Hàm tiện ích để thiết lập cookie
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true trong production, false trong development
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 phút
      path: '/',
      domain: '127.0.0.1'
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      path: '/',
      domain:'127.0.0.1'
    });
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.register(registerDto);
    console.log(accessToken, refreshToken, user)
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.authService.login(loginDto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Get('google')
  async googleAuth(@Res() res: Response): Promise<void> {
    const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
      `?response_type=code` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALL_BACK)}` +
      `&scope=${encodeURIComponent('email profile')}` +
      `&client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID)}`;

    res.redirect(redirectUrl);
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const { user } = req;
    const { accessToken, refreshToken } = await this.authService.validateGoogleUser(user);
    this.setAuthCookies(res, accessToken, refreshToken);

    const userData = { id: user.id, email: user.email, fullName: user.fullName, picture: user.picture };
    res.redirect(`${process.env.NEXT_APP_URL}/auth/success?user=${encodeURIComponent(JSON.stringify(userData))}`);
  }

  @Post('refresh')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) throw new HttpException('Refresh token missing', HttpStatus.UNAUTHORIZED);

    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, accessToken, newRefreshToken);
    return { message: 'Token refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    await this.authService.logout((req.user as any).id, req.cookies?.accessToken);

    // Xóa cookie
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.user;
  }
}
