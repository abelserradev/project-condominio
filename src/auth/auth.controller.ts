import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { UseGuards } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto para prevenir fuerza bruta
  async login(@Body() body: { usuario?: string; contraseña?: string }) {
    if (!body.usuario?.trim() || !body.contraseña) {
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }
    try {
      const result = await this.authService.login(body.usuario.trim(), body.contraseña);
      return result;
    } catch (e) {
      throw e;
    }
  }
}