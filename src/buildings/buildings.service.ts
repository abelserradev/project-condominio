import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Building, BuildingDocument } from './schemas/building.schema';
import { buildPortalUrl } from './utils/portal-url.util';
import { MailService } from '../common/services/mail.service';
const SLUGS_RESERVADOS = new Set([
  'super',
  'admin',
  'api',
  'www',
  'mail',
  'app',
  'static',
  'assets',
  'login',
  'registro',
]);

function serializarReglamentoFileId(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'toString' in value) {
    return (value as { toString: () => string }).toString();
  }
  return null;
}

@Injectable()
export class BuildingsService {
  private readonly logger = new Logger(BuildingsService.name);

  constructor(
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    private readonly mailService: MailService,
  ) {}

  async findBySlug(slug: string): Promise<BuildingDocument | null> {
    return this.buildingModel
      .findOne({ slug: slug.toLowerCase().trim() })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<BuildingDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.buildingModel.findById(id).lean().exec();
  }

  async findAll(): Promise<BuildingDocument[]> {
    return this.buildingModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  isSlugReservado(slug: string): boolean {
    return SLUGS_RESERVADOS.has(slug.toLowerCase().trim());
  }

  async create(data: {
    slug: string;
    nombre: string;
    direccion?: string;
    totalPisos: number;
    apartamentosPorPiso: number;
  }): Promise<BuildingDocument> {
    const slugNorm = data.slug.toLowerCase().trim();

    if (SLUGS_RESERVADOS.has(slugNorm)) {
      throw new BadRequestException(
        `El subdominio "${slugNorm}" está reservado y no puede usarse`,
      );
    }

    const existente = await this.buildingModel
      .findOne({ slug: slugNorm })
      .lean();
    if (existente)
      throw new ConflictException('Este subdominio ya está en uso');

    const suscripcionHasta = new Date();
    suscripcionHasta.setDate(suscripcionHasta.getDate() + 14);

    const doc = await this.buildingModel.create({
      ...data,
      slug: slugNorm,
      activo: true,
      estadoSuscripcion: 'trial',
      suscripcionHasta,
    });

    return doc.toObject();
  }

  /** Respuesta estándar tras registrar o aprovisionar un tenant nuevo */
  buildRegisterResponse(
    building: BuildingDocument,
    adminEmail?: string,
  ): {
    slug: string;
    nombre: string;
    portalUrl: string;
    trialHasta: string;
    buildingId: string;
    adminEmail?: string;
  } {
    return {
      slug: building.slug,
      nombre: building.nombre,
      portalUrl: buildPortalUrl(building.slug),
      trialHasta:
        building.suscripcionHasta?.toISOString() ?? new Date().toISOString(),
      buildingId: building._id.toString(),
      ...(adminEmail && { adminEmail }),
    };
  }

  async sendWelcomeEmail(
    adminEmail: string,
    building: BuildingDocument,
  ): Promise<void> {
    const portalUrl = buildPortalUrl(building.slug);
    const loginUrl = `${portalUrl}/admin/login`;
    await this.mailService.sendWelcomeEmail({
      to: adminEmail,
      nombreEdificio: building.nombre,
      portalUrl,
      loginUrl,
    });
  }

  // Usado por el SuperAdmin para renovar suscripciones
  async renovarSuscripcion(
    buildingId: string,
    diasAgregados: number,
    nota: string,
    renovadoPor: string,
  ): Promise<BuildingDocument> {
    const building = await this.buildingModel.findById(buildingId).exec();
    if (!building) throw new NotFoundException('Edificio no encontrado');

    const base =
      building.suscripcionHasta && building.suscripcionHasta > new Date()
        ? building.suscripcionHasta
        : new Date();

    const nuevaFecha = new Date(base);
    nuevaFecha.setDate(nuevaFecha.getDate() + diasAgregados);

    const updated = await this.buildingModel
      .findByIdAndUpdate(
        buildingId,
        {
          $set: { estadoSuscripcion: 'activo', suscripcionHasta: nuevaFecha },
          $push: {
            historialRenovaciones: {
              fecha: new Date(),
              renovadoPor,
              diasAgregados,
              nota,
            },
          },
        },
        { new: true },
      )
      .lean()
      .exec();

    return updated as BuildingDocument;
  }

  async suspender(buildingId: string): Promise<BuildingDocument> {
    const updated = await this.buildingModel
      .findByIdAndUpdate(
        buildingId,
        { $set: { estadoSuscripcion: 'suspendido', activo: false } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Edificio no encontrado');
    return updated;
  }

  // Marcar como vencido — se llama en background cuando expira el período de gracia
  // TODO: Mover a un cron job cuando el volumen de edificios lo justifique
  async marcarVencido(buildingId: Types.ObjectId): Promise<void> {
    await this.buildingModel
      .updateOne(
        { _id: buildingId, estadoSuscripcion: { $ne: 'suspendido' } },
        { $set: { estadoSuscripcion: 'vencido' } },
      )
      .exec();
  }

  async updateDatosContactoPago(
    buildingId: string,
    datosContactoPago: string,
  ): Promise<BuildingDocument> {
    const updated = await this.buildingModel
      .findByIdAndUpdate(
        buildingId,
        { $set: { datosContactoPago } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Edificio no encontrado');
    return updated;
  }

  // Info de suscripción para el admin del edificio (banner + modal de pago)
  async getSuscripcionInfo(buildingId: Types.ObjectId): Promise<{
    nombre: string;
    slug: string;
    estadoSuscripcion: string;
    suscripcionHasta: Date | undefined;
    diasGracia: number;
    datosContactoPago?: string;
  } | null> {
    const b = await this.buildingModel.findById(buildingId).lean().exec();
    if (!b) return null;
    return {
      nombre: b.nombre,
      slug: b.slug,
      estadoSuscripcion: b.estadoSuscripcion,
      suscripcionHasta: b.suscripcionHasta,
      diasGracia: b.diasGracia ?? 3,
      datosContactoPago: b.datosContactoPago,
    };
  }

  async getReglamento(buildingId: Types.ObjectId): Promise<{
    nombre: string;
    fileId: string;
    actualizadoEn: string;
  } | null> {
    const b = await this.buildingModel.findById(buildingId).lean().exec();
    if (!b) return null;
    const reglamentoDoc = b as {
      reglamentoFileId?: unknown;
      reglamentoNombre?: unknown;
      reglamentoActualizadoEn?: unknown;
    };
    const fileId = serializarReglamentoFileId(reglamentoDoc.reglamentoFileId);
    if (!fileId) return null;
    return {
      nombre:
        typeof reglamentoDoc.reglamentoNombre === 'string'
          ? reglamentoDoc.reglamentoNombre
          : 'Reglamento',
      fileId,
      actualizadoEn:
        reglamentoDoc.reglamentoActualizadoEn instanceof Date
          ? reglamentoDoc.reglamentoActualizadoEn.toISOString()
          : new Date().toISOString(),
    };
  }

  async setReglamento(
    buildingId: Types.ObjectId,
    fileId: Types.ObjectId,
    nombre: string,
  ): Promise<BuildingDocument> {
    const updated = await this.buildingModel
      .findByIdAndUpdate(
        buildingId,
        {
          $set: {
            reglamentoFileId: fileId,
            reglamentoNombre: nombre,
            reglamentoActualizadoEn: new Date(),
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Edificio no encontrado');
    return updated;
  }

  async clearReglamento(buildingId: Types.ObjectId): Promise<BuildingDocument> {
    const updated = await this.buildingModel
      .findByIdAndUpdate(
        buildingId,
        {
          $unset: {
            reglamentoFileId: '',
            reglamentoNombre: '',
            reglamentoActualizadoEn: '',
          },
        },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Edificio no encontrado');
    return updated;
  }
}
