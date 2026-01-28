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
    const user = await this.userService.findByUsuario(usuario);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const valid = await this.userService.validatePassword(contraseña, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = { sub: (user as { _id: string })._id.toString(), usuario: user.usuario };
    return { access_token: this.jwtService.sign(payload) };
  }
}