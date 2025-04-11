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
      maxAge: 3 * 24 * 60 * 60 * 1000, // 3 ngày
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
    //res.redirect(`${process.env.NEXT_APP_URL}/auth/success?user=${encodeURIComponent(JSON.stringify(userData))}`);
    return JSON.stringify(user);
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
  async googleAuthRedirect(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { user } = req;
    const { accessToken, refreshToken, user: userData } = await this.authService.validateGoogleUser(user);
  
    this.setAuthCookies(res, accessToken, refreshToken);
  
    res.redirect(`${process.env.NEXT_APP_URL}/dashboard`);
    return JSON.stringify(userData);
  }
  

  @Post('refresh')
  async refreshToken(@Req() req: Request, @Res() res: Response) {
    console.log("chào", req.cookies.refreshToken);
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      this.clearAuthCookies(res);
      throw new HttpException('Refresh token missing', HttpStatus.UNAUTHORIZED);
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } =
      await this.authService.refreshToken(refreshToken);

      this.setAuthCookies(res, accessToken, newRefreshToken);
      return res.json({ message: 'Token refreshed successfully' });
    } catch (error) {
      console.error('Invalid refresh token:', error);
      this.clearAuthCookies(res);
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid refresh token' });
    }
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {

    // Xóa cookie với đúng thông số như khi set cookie
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',  // Đảm bảo xóa cookie với cùng path
      //domain: '127.0.0.1'  // Đảm bảo domain chính xác
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',  // Đảm bảo xóa cookie với cùng path
      //domain: '127.0.0.1'  // Đảm bảo domain chính xác
    });

    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Req() req: Request) {
    return req.user;
  }
}
