import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Payload extendido para el sistema multi-tenant
type JwtPayload = {
  sub: string;
  usuario?: string;
  rol: string;
  isSuperAdmin?: boolean;
  buildingId?: string;
  edificio?: string;
  piso?: number;
  apartamento?: number;
  idUnico?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret.trim() === '') {
      throw new Error('JWT_SECRET debe estar definido en las variables de entorno');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Token inválido: payload incompleto');
    }

    // Propagar todos los campos del JWT al req.user para que los controladores los lean sin queries extra
    return {
      sub: payload.sub,
      usuario: payload.usuario,
      rol: payload.rol ?? 'admin',
      isSuperAdmin: payload.isSuperAdmin ?? false,
      buildingId: payload.buildingId,
      edificio: payload.edificio,
      piso: payload.piso,
      apartamento: payload.apartamento,
      idUnico: payload.idUnico,
    };
  }
}
