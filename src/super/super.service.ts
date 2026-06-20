import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BuildingsService } from '../buildings/buildings.service';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import { ApartmentsService } from '../apartments/apartments.service';
import { UserService } from '../user/user.service';
import { CreateBuildingDto } from './dto/create-building.dto';

@Injectable()
export class SuperService {
  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly apartmentsService: ApartmentsService,
    private readonly userService: UserService,
  ) {}

  async listarEdificios(): Promise<BuildingDocument[]> {
    return this.buildingsService.findAll();
  }

  async obtenerEdificio(id: string): Promise<BuildingDocument> {
    const building = await this.buildingsService.findById(id);
    if (!building) throw new NotFoundException('Edificio no encontrado');
    return building;
  }

  async crearEdificio(dto: CreateBuildingDto): Promise<BuildingDocument> {
    const building = await this.buildingsService.create({
      slug: dto.slug,
      nombre: dto.nombre,
      direccion: dto.direccion,
      totalPisos: dto.totalPisos,
      apartamentosPorPiso: dto.apartamentosPorPiso,
    });

    if (dto.datosContactoPago) {
      await this.buildingsService.updateDatosContactoPago(
        building._id.toString(),
        dto.datosContactoPago,
      );
    }

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

    const creado = await this.buildingsService.findById(building._id.toString());
    if (!creado) throw new NotFoundException('Edificio no encontrado tras crear');
    return creado;
  }

  async renovarSuscripcion(
    buildingId: string,
    diasAgregados: number,
    nota: string | undefined,
    renovadoPor: string,
  ): Promise<BuildingDocument> {
    return this.buildingsService.renovarSuscripcion(
      buildingId,
      diasAgregados,
      nota ?? '',
      renovadoPor,
    );
  }

  async suspenderEdificio(buildingId: string): Promise<BuildingDocument> {
    return this.buildingsService.suspender(buildingId);
  }

  async actualizarDatosPago(buildingId: string, datos: string): Promise<BuildingDocument> {
    return this.buildingsService.updateDatosContactoPago(buildingId, datos);
  }
}
