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

    // #region agent log
    fetch('http://127.0.0.1:7770/ingest/8d24192f-e050-43eb-bac5-e21e3ba0ea2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c886b'},body:JSON.stringify({sessionId:'5c886b',runId:'pre-fix',hypothesisId:'H2-H4',location:'onboarding.service.ts:registerBuilding',message:'Edificio registrado',data:{slug:building.slug,buildingId:building._id?.toString(),dtoTotalPisos:dto.totalPisos,dtoAptsPorPiso:dto.apartamentosPorPiso,storedTotalPisos:building.totalPisos,storedAptsPorPiso:building.apartamentosPorPiso},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
