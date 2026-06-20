import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { OwnersService } from '../owners/owners.service';
import { BuildingsService } from '../buildings/buildings.service';
import { BuildingDocument } from '../buildings/schemas/building.schema';

export type LoginResult = {
  access_token: string;
  rol: string;
  edificio?: string;
  buildingId?: string;
  piso?: number;
  apartamento?: number;
  idUnico?: string;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly ownersService: OwnersService,
    private readonly buildingsService: BuildingsService,
    private readonly jwtService: JwtService,
  ) {}

  async login(
    usuario: string,
    contraseña: string,
    buildingSlug?: string,
  ): Promise<LoginResult> {
    let building: BuildingDocument | null = null;

    if (buildingSlug) {
      building = await this.buildingsService.findBySlug(buildingSlug);
    }

    const buildingId = building ? (building._id as Types.ObjectId) : undefined;

    // 1. Intentar autenticar como admin (usuario/contraseña o email/contraseña)
    const user = await this.userService.findByUsuario(usuario.trim());

    if (user) {
      const valid = await this.userService.validatePassword(contraseña, user.passwordHash);
      if (!valid) {
        this.logger.warn(`Login fallido (contraseña inválida) para: ${usuario}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const isSuperAdmin = user.isSuperAdmin === true;
      if (isSuperAdmin) {
        this.logger.warn(`Login SuperAdmin: ${usuario}`);
      }
      const userBuildingId = user.buildingId ?? buildingId;

      const payload: Record<string, unknown> = {
        sub: (user as { _id: Types.ObjectId })._id.toString(),
        usuario: user.usuario,
        rol: isSuperAdmin ? 'superadmin' : 'admin',
        isSuperAdmin,
        ...(userBuildingId && { buildingId: userBuildingId.toString() }),
        ...(building && { edificio: building.nombre }),
      };

      this.logger.log(`Login exitoso para admin: ${usuario} | edificio: ${building?.nombre ?? 'no especificado'}`);
      return {
        access_token: this.jwtService.sign(payload),
        rol: payload.rol as string,
        edificio: building?.nombre,
        buildingId: userBuildingId?.toString(),
      };
    }

    // 2. Intentar autenticar como propietario (email + buildingId)
    if (buildingId) {
      const owner = await this.ownersService.findByEmail(usuario.trim(), buildingId);

      if (owner) {
        const bcrypt = await import('bcrypt');
        const valid = await bcrypt.compare(contraseña, owner.passwordHash);

        if (!valid) {
          this.logger.warn(`Login fallido (propietario) para: ${usuario}`);
          throw new UnauthorizedException('Credenciales inválidas');
        }

        const payload = {
          sub: (owner as { _id: Types.ObjectId })._id.toString(),
          rol: owner.rol,
          isSuperAdmin: false,
          buildingId: buildingId.toString(),
          edificio: building!.nombre,
          piso: owner.piso,
          apartamento: owner.apartamento,
          idUnico: owner.idUnico,
        };

        this.logger.log(`Login exitoso para propietario: ${usuario} | edificio: ${building!.nombre}`);
        return {
          access_token: this.jwtService.sign(payload),
          rol: owner.rol,
          edificio: building!.nombre,
          buildingId: buildingId.toString(),
          piso: owner.piso,
          apartamento: owner.apartamento,
          idUnico: owner.idUnico,
        };
      }
    }

    this.logger.warn(`Login fallido: usuario no encontrado: ${usuario}`);
    throw new UnauthorizedException('Credenciales inválidas');
  }
}
