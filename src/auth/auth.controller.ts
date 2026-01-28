import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { usuario?: string; contraseña?: string }) {
    console.log('[AuthController] login - Body recibido:', JSON.stringify(body));
    if (!body.usuario?.trim() || !body.contraseña) {
      console.log('[AuthController] login - Faltan credenciales');
      throw new UnauthorizedException('Usuario y contraseña requeridos');
    }
    try {
      console.log('[AuthController] login - Intentando autenticar usuario:', body.usuario.trim());
      const result = await this.authService.login(body.usuario.trim(), body.contraseña);
      console.log('[AuthController] login - Autenticación exitosa');
      return result;
    } catch (e) {
      console.error('[AuthController] login - Error:', e);
      throw e;
    }
  }
}