import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CsrfGuard } from '../common/guards/csrf.guard';

const LOGIN_THROTTLE_LIMIT = process.env.NODE_ENV === 'production' ? 5 : 30;

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private authService: AuthService) {}

  @Post('login')
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60000 } })
  async login(
    @Body() body: { usuario?: string; contraseña?: string },
    @Req() req: { headers: Record<string, string> },
  ) {
    if (!body.usuario?.trim() || !body.contraseña) {
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }

    // El slug llega del header x-building-slug (inyectado por el middleware del frontend)
    const buildingSlug: string | undefined = req.headers['x-building-slug'];

    try {
      const result = await this.authService.login(
        body.usuario.trim(),
        body.contraseña,
        buildingSlug,
      );
      this.logger.log(`Login exitoso: ${body.usuario.trim()}`);
      return result;
    } catch (e) {
      this.logger.warn(
        `Login fallido: ${body.usuario?.trim() ?? 'desconocido'}`,
      );
      throw e;
    }
  }
}
