import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { BuildingsService } from '../buildings/buildings.service';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import { ApartmentsService } from '../apartments/apartments.service';
import { UserService } from '../user/user.service';
import { FilesService } from '../files/files.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { buildPortalUrl } from '../buildings/utils/portal-url.util';
import { Types } from 'mongoose';
import {
  validateFileMimeType,
  validateFileSize,
} from '../common/utils/file-validation.util';

const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const BANNER_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

@Injectable()
export class SuperService {
  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly apartmentsService: ApartmentsService,
    private readonly userService: UserService,
    private readonly filesService: FilesService,
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
    await this.buildingsService.sendWelcomeEmail(adminEmail, building);

    const creado = await this.buildingsService.findById(
      building._id.toString(),
    );
    if (!creado)
      throw new NotFoundException('Edificio no encontrado tras crear');
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

  async actualizarDatosPago(
    buildingId: string,
    datos: string,
  ): Promise<BuildingDocument> {
    return this.buildingsService.updateDatosContactoPago(buildingId, datos);
  }

  async obtenerAdminEdificio(buildingId: string): Promise<{
    usuario: string;
    email?: string;
    portalUrl: string;
  }> {
    const building = await this.buildingsService.findById(buildingId);
    if (!building) throw new NotFoundException('Edificio no encontrado');
    const admin = await this.userService.findAdminByBuildingId(
      new Types.ObjectId(buildingId),
    );
    if (!admin) throw new NotFoundException('Administrador no encontrado');
    return {
      usuario: admin.usuario,
      email: admin.email,
      portalUrl: buildPortalUrl(building.slug),
    };
  }

  async resetAdminPassword(
    buildingId: string,
    nuevaPassword: string,
  ): Promise<{ ok: true; usuario: string }> {
    if (!nuevaPassword || nuevaPassword.length < 6) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 6 caracteres',
      );
    }
    const admin = await this.userService.resetAdminPasswordByBuilding(
      new Types.ObjectId(buildingId),
      nuevaPassword,
    );
    if (!admin) throw new NotFoundException('Administrador no encontrado');
    return { ok: true, usuario: admin.usuario };
  }

  async subirPortalBanner(
    buildingId: string,
    file: Express.Multer.File,
  ): Promise<{ bannerUrl: string }> {
    const building = await this.buildingsService.findById(buildingId);
    if (!building) throw new NotFoundException('Edificio no encontrado');
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe adjuntar una imagen');
    }
    validateFileSize(file.buffer, MAX_BANNER_BYTES);
    const mime = validateFileMimeType(file.buffer, file.mimetype);
    if (!BANNER_MIMES.has(mime)) {
      throw new BadRequestException(
        'Solo se permiten imágenes JPEG, PNG, WebP o GIF',
      );
    }
    const fileId = await this.filesService.upload(file.buffer, {
      filename: file.originalname ?? 'banner-portal.jpg',
      mimetype: mime,
    });
    await this.buildingsService.setPortalBanner(
      new Types.ObjectId(buildingId),
      fileId,
    );
    return { bannerUrl: `/files/${fileId.toString()}` };
  }

  async eliminarPortalBanner(buildingId: string): Promise<{ ok: true }> {
    const building = await this.buildingsService.findById(buildingId);
    if (!building) throw new NotFoundException('Edificio no encontrado');
    await this.buildingsService.clearPortalBanner(
      new Types.ObjectId(buildingId),
    );
    return { ok: true };
  }
}
