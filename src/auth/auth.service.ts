import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import { UserService } from '../user/user.service';
import { OwnersService } from '../owners/owners.service';
import { BuildingsService } from '../buildings/buildings.service';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import { UserDocument } from '../user/schemas/user.schema';

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
    const building = await this.resolveBuilding(buildingSlug);
    const buildingId = building?._id;
    const usuarioNormalizado = usuario.trim().toLowerCase();

    if (buildingId && building) {
      const adminTenant = await this.userService.findAdminByUsuarioAndBuilding(
        usuarioNormalizado,
        buildingId,
      );
      if (adminTenant) {
        return this.loginAsAdmin(adminTenant, contraseña, building, buildingId);
      }
      const ownerResult = await this.loginAsOwner(
        usuarioNormalizado,
        contraseña,
        building,
        buildingId,
      );
      if (ownerResult) {
        return ownerResult;
      }
      this.logger.warn(
        `Login fallido en edificio ${building.slug}: ${usuarioNormalizado}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const superAdmin =
      await this.userService.findSuperAdminByUsuario(usuarioNormalizado);
    if (superAdmin) {
      return this.loginAsAdmin(superAdmin, contraseña, building, buildingId);
    }

    this.logger.warn(`Login fallido: usuario no encontrado: ${usuario}`);
    throw new UnauthorizedException('Credenciales inválidas');
  }

  private async resolveBuilding(
    buildingSlug?: string,
  ): Promise<BuildingDocument | null> {
    if (!buildingSlug) {
      return null;
    }
    return this.buildingsService.findBySlug(buildingSlug);
  }

  private async loginAsAdmin(
    user: UserDocument,
    contraseña: string,
    building: BuildingDocument | null,
    buildingId: Types.ObjectId | undefined,
  ): Promise<LoginResult> {
    const valid = await this.userService.validatePassword(
      contraseña,
      user.passwordHash,
    );
    if (!valid) {
      this.logger.warn(
        `Login fallido (contraseña inválida) para: ${user.usuario}`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const isSuperAdmin = user.isSuperAdmin === true;
    if (isSuperAdmin) {
      this.logger.warn(`Login SuperAdmin: ${user.usuario}`);
    }
    const userBuildingId = user.buildingId ?? buildingId;
    const rol = isSuperAdmin ? 'superadmin' : 'admin';
    const payload: Record<string, unknown> = {
      sub: user._id.toString(),
      usuario: user.usuario,
      rol,
      isSuperAdmin,
      ...(userBuildingId && { buildingId: userBuildingId.toString() }),
      ...(building && { edificio: building.nombre }),
    };
    this.logger.log(
      `Login exitoso para admin: ${user.usuario} | edificio: ${building?.nombre ?? 'no especificado'}`,
    );
    return {
      access_token: this.jwtService.sign(payload),
      rol,
      edificio: building?.nombre,
      buildingId: userBuildingId?.toString(),
    };
  }

  private async loginAsOwner(
    usuario: string,
    contraseña: string,
    building: BuildingDocument,
    buildingId: Types.ObjectId,
  ): Promise<LoginResult | null> {
    const owner = await this.ownersService.findByEmail(usuario, buildingId);
    if (!owner) {
      return null;
    }
    const bcrypt = await import('bcrypt');
    const valid = await bcrypt.compare(contraseña, owner.passwordHash);
    if (!valid) {
      this.logger.warn(`Login fallido (propietario) para: ${usuario}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const payload = {
      sub: owner._id.toString(),
      rol: owner.rol,
      isSuperAdmin: false,
      buildingId: buildingId.toString(),
      edificio: building.nombre,
      piso: owner.piso,
      apartamento: owner.apartamento,
      idUnico: owner.idUnico,
    };
    this.logger.log(
      `Login exitoso para propietario: ${usuario} | edificio: ${building.nombre}`,
    );
    return {
      access_token: this.jwtService.sign(payload),
      rol: owner.rol,
      edificio: building.nombre,
      buildingId: buildingId.toString(),
      piso: owner.piso,
      apartamento: owner.apartamento,
      idUnico: owner.idUnico,
    };
  }
}
