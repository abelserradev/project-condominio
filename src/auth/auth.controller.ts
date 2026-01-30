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
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // Relajado en dev para debug; ajustar a 5 en prod
  async login(@Body() body: { usuario?: string; contraseña?: string }) {
    console.log('[Auth] login body recibido', {
      usuario: body?.usuario ?? '(undefined)',
      usuarioLength: body?.usuario?.length ?? 0,
      tieneContraseña: !!body?.contraseña,
      contraseñaLength: body?.contraseña?.length ?? 0,
    });
    if (!body.usuario?.trim() || !body.contraseña) {
      console.log('[Auth] login rechazado: usuario o contraseña faltantes');
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }
    try {
      const result = await this.authService.login(body.usuario.trim(), body.contraseña);
      console.log('[Auth] login OK', { usuario: body.usuario.trim() });
      return result;
    } catch (e) {
      console.log('[Auth] login error', e instanceof Error ? e.message : String(e));
      throw e;
    }
  }
}