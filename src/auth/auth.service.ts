import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';


@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async login(usuario: string, contraseña: string): Promise<{ access_token: string }> {
    console.log('[AuthService] login intento usuario=', usuario);
    const user = await this.userService.findByUsuario(usuario);
    if (!user) {
      console.log('[AuthService] usuario no encontrado:', usuario);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await this.userService.validatePassword(contraseña, user.passwordHash);
    if (!valid) {
      console.log('[AuthService] contraseña incorrecta para:', usuario);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    console.log('[AuthService] login ok:', usuario);
    const payload = { sub: (user as { _id: string })._id.toString(), usuario: user.usuario };
    return { access_token: this.jwtService.sign(payload) };
  }
}