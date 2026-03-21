import { Body, Controller, Post, UnauthorizedException, UseGuards, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CsrfGuard } from '../common/guards/csrf.guard';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(CsrfGuard)
  // TODO: Bajar a limit: 5 en producción para mitigar fuerza bruta
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async login(@Body() body: { usuario?: string; contraseña?: string }) {
    if (!body.usuario?.trim() || !body.contraseña) {
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }
    try {
      const result = await this.authService.login(body.usuario.trim(), body.contraseña);
      this.logger.log(`Login exitoso para usuario: ${body.usuario.trim()}`);
      return result;
    } catch (e) {
      this.logger.warn(`Login fallido para usuario: ${body.usuario?.trim() ?? 'desconocido'}`);
      throw e;
    }
  }
}