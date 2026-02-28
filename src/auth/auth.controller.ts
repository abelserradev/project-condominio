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
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // TODO: Ajustar a 5 en prod
  async login(@Body() body: { usuario?: string; contraseña?: string }) {
    if (!body.usuario?.trim() || !body.contraseña) {
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }
    try {
      const result = await this.authService.login(body.usuario.trim(), body.contraseña);
      this.logger.log(`Login OK: ${body.usuario.trim()}`);
      return result;
    } catch (e) {
      this.logger.warn(`Login fallido: ${e instanceof Error ? e.message : String(e)}`);
      throw e;
    }
  }
}