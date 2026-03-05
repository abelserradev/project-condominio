import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async login(usuario: string, contraseña: string): Promise<{ access_token: string }> {
    this.logger.log(`[DEBUG] login intento para usuario: ${usuario}`);
    const user = await this.userService.findByUsuario(usuario);
    if (!user) {
      this.logger.log(`[DEBUG] login fallido: usuario no encontrado en BD`);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await this.userService.validatePassword(contraseña, user.passwordHash);
    if (!valid) {
      this.logger.log(`[DEBUG] login fallido: contraseña incorrecta`);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    this.logger.log(`[DEBUG] login OK para usuario: ${usuario}`);
    const payload = { sub: (user as { _id: string })._id.toString(), usuario: user.usuario };
    return { access_token: this.jwtService.sign(payload) };
  }
}
