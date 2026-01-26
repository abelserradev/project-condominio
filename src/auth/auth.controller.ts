import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { usuario?: string; contraseña?: string }) {
    console.log('[AuthController] POST /auth/login', {
      usuario: body.usuario ?? '(vacío)',
      tieneContraseña: !!body.contraseña,
    });
    if (!body.usuario?.trim() || !body.contraseña) {
      console.log('[AuthController] 401: usuario o contraseña faltantes');
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }
    try {
      const result = await this.authService.login(body.usuario.trim(), body.contraseña);
      console.log('[AuthController] 200: login ok para', body.usuario.trim());
      return result;
    } catch (e) {
      console.log('[AuthController] 401: login fallido', (e as Error).message);
      throw e;
    }
  }
}