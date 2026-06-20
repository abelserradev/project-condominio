import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Aviso, AvisoDocument } from './schemas/aviso.schema';
import { CreateAvisoDto } from './dto/create-aviso.dto';
import { UpdateAvisoDto } from './dto/update-aviso.dto';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AvisosService {
  constructor(
    @InjectModel(Aviso.name) private readonly avisoModel: Model<AvisoDocument>,
    private readonly cacheService: CacheService,
  ) {}

  async findAll(buildingId?: Types.ObjectId): Promise<AvisoDocument[]> {
    const q: Record<string, unknown> = {};
    if (buildingId) q.buildingId = buildingId;
    return this.avisoModel.find(q).sort({ createdAt: -1 }).lean().exec();
  }

  private validateObjectId(id: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`ID de aviso inválido: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  async findOne(
    id: string,
    buildingId?: Types.ObjectId,
  ): Promise<AvisoDocument | null> {
    const objectId = this.validateObjectId(id);
    const q: Record<string, unknown> = { _id: objectId };
    if (buildingId) q.buildingId = buildingId;
    return this.avisoModel.findOne(q).lean().exec();
  }

  async create(
    dto: CreateAvisoDto,
    buildingId?: Types.ObjectId,
  ): Promise<AvisoDocument> {
    const doc = new this.avisoModel({
      buildingId,
      titulo: dto.titulo.trim(),
      mensaje: dto.mensaje.trim(),
      tipo: dto.tipo,
      prioridad: dto.prioridad ?? 'media',
      estado: dto.estado ?? 'borrador',
    });
    return doc.save();
  }

  async update(
    id: string,
    dto: UpdateAvisoDto,
    buildingId?: Types.ObjectId,
  ): Promise<AvisoDocument | null> {
    const objectId = this.validateObjectId(id);
    const update: Record<string, unknown> = {};
    if (dto.titulo !== undefined) update.titulo = dto.titulo.trim();
    if (dto.mensaje !== undefined) update.mensaje = dto.mensaje.trim();
    if (dto.tipo !== undefined) update.tipo = dto.tipo;
    if (dto.prioridad !== undefined) update.prioridad = dto.prioridad;
    if (dto.estado !== undefined) update.estado = dto.estado;
    if (Object.keys(update).length === 0) {
      const q: Record<string, unknown> = { _id: objectId };
      if (buildingId) q.buildingId = buildingId;
      return this.avisoModel.findOne(q).lean().exec();
    }
    const filter: Record<string, unknown> = { _id: objectId };
    if (buildingId) filter.buildingId = buildingId;
    const doc = await this.avisoModel
      .findOneAndUpdate(filter, { $set: update }, { new: true })
      .lean()
      .exec();
    return doc ?? null;
  }

  async remove(id: string, buildingId?: Types.ObjectId): Promise<void> {
    const objectId = this.validateObjectId(id);
    const filter: Record<string, unknown> = { _id: objectId };
    if (buildingId) filter.buildingId = buildingId;
    const result = await this.avisoModel.findOneAndDelete(filter).exec();
    if (!result) {
      throw new NotFoundException(`Aviso con id ${id} no encontrado`);
    }
  }

  /**
   * Cuenta avisos publicados más recientes que la última visita del dispositivo.
   * Sin deviceId o sin Redis: devuelve 0 (badge oculto).
   */
  async getUnreadCount(
    deviceId: string | null,
    buildingId?: Types.ObjectId,
  ): Promise<number> {
    if (!deviceId) return 0;

    const lastReadAt = await this.cacheService.getAvisosLastRead(deviceId);

    const q: Record<string, unknown> = { estado: 'publicado' };
    if (buildingId) q.buildingId = buildingId;

    const publicados = await this.avisoModel
      .find(q)
      .select('createdAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (publicados.length === 0) return 0;

    const lastRead = lastReadAt ?? 0;
    const count = publicados.filter((a) => {
      const raw = (a as { createdAt?: Date }).createdAt;
      const ts =
        raw instanceof Date ? raw.getTime() : new Date(String(raw)).getTime();
      return ts > lastRead;
    }).length;

    return count;
  }

  async markAsRead(deviceId: string): Promise<void> {
    if (deviceId) {
      await this.cacheService.setAvisosLastRead(deviceId);
    }
  }
}
