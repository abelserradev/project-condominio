import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { BuildingsService } from '../buildings/buildings.service';
import { ApartmentsService } from '../apartments/apartments.service';
import { UserService } from '../user/user.service';
import { RegisterBuildingDto } from '../buildings/dto/register-building.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly apartmentsService: ApartmentsService,
    private readonly userService: UserService,
  ) {}

  async registerBuilding(dto: RegisterBuildingDto) {
    const building = await this.buildingsService.create({
      slug: dto.slug,
      nombre: dto.nombre,
      direccion: dto.direccion,
      totalPisos: dto.totalPisos,
      apartamentosPorPiso: dto.apartamentosPorPiso,
    });

    await this.apartmentsService.seedForBuilding(
      building._id as Types.ObjectId,
      dto.totalPisos,
      dto.apartamentosPorPiso,
    );

    await this.userService.createAdminForBuilding({
      usuario: dto.adminUsuario,
      password: dto.adminPassword,
      buildingId: building._id as Types.ObjectId,
    });

    const response = this.buildingsService.buildRegisterResponse(building);
    this.buildingsService.logWelcomeEmail(building.slug, dto.adminUsuario, response.portalUrl);

    return response;
  }
}
