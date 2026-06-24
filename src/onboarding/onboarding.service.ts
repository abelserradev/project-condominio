import { Injectable } from '@nestjs/common';
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
      building._id,
      dto.totalPisos,
      dto.apartamentosPorPiso,
    );

    await this.userService.createAdminForBuilding({
      email: dto.adminEmail,
      password: dto.adminPassword,
      buildingId: building._id,
    });

    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const response = this.buildingsService.buildRegisterResponse(
      building,
      adminEmail,
    );
    await this.buildingsService.sendWelcomeEmail(adminEmail, building);

    return response;
  }
}
