import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Owner, OwnerDocument } from './schemas/owner.schema';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { validatePasswordStrength } from '../common/utils/password.util';
import { Apartment, apartmentschema, apartmentdocument } from '../apartments/schemas/apartment.schema';

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    @InjectModel(Owner.name) private ownerModel: Model<OwnerDocument>,
    @InjectModel(Apartment.name) private apartmentModel: Model<apartmentdocument>,
  ) {}

  async findByEmail(email: string, buildingId: Types.ObjectId): Promise<OwnerDocument | null> {
    return this.ownerModel
      .findOne({ email: email.toLowerCase().trim(), buildingId, activo: true })
      .lean()
      .exec();
  }

  async findByApartamento(
    piso: number,
    apartamento: number,
    buildingId: Types.ObjectId,
  ): Promise<OwnerDocument | null> {
    return this.ownerModel.findOne({ piso, apartamento, buildingId, activo: true }).lean().exec();
  }

  async findAll(buildingId: Types.ObjectId, incluirInactivos = false): Promise<OwnerDocument[]> {
    const q: Record<string, unknown> = { buildingId };
    if (!incluirInactivos) q.activo = true;
    return this.ownerModel.find(q).sort({ piso: 1, apartamento: 1, nombre: 1 }).lean().exec();
  }

  async findById(id: string, buildingId: Types.ObjectId): Promise<OwnerDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.ownerModel.findOne({ _id: id, buildingId }).lean().exec();
  }

  async create(buildingId: Types.ObjectId, dto: CreateOwnerDto): Promise<OwnerDocument> {
    validatePasswordStrength(dto.password);

    const apt = await this.apartmentModel
      .findOne({ buildingId, piso: dto.piso, numero: dto.apartamento })
      .lean()
      .exec();
    if (!apt) {
      throw new BadRequestException(
        `No existe el apartamento P${dto.piso}-A${dto.apartamento} en este edificio`,
      );
    }

    const emailNorm = dto.email.toLowerCase().trim();
    const duplicado = await this.ownerModel.findOne({ buildingId, email: emailNorm }).lean();
    if (duplicado) {
      throw new ConflictException('Ya hay un propietario registrado con ese correo');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const idUnico = `P${dto.piso}-A${dto.apartamento}`;

    const doc = await this.ownerModel.create({
      buildingId,
      nombre: dto.nombre.trim(),
      email: emailNorm,
      passwordHash,
      piso: dto.piso,
      apartamento: dto.apartamento,
      idUnico,
      rol: dto.rol,
      activo: true,
    });

    // TODO: enviar invitación real con Resend cuando esté configurado SMTP
    this.logger.log(
      `[invitación] Nuevo ${dto.rol} "${dto.nombre}" <${emailNorm}> | apt ${idUnico} | contraseña inicial establecida`,
    );

    return doc.toObject() as OwnerDocument;
  }

  async update(
    id: string,
    buildingId: Types.ObjectId,
    dto: UpdateOwnerDto,
  ): Promise<OwnerDocument> {
    const existente = await this.ownerModel.findOne({ _id: id, buildingId }).exec();
    if (!existente) throw new NotFoundException('Propietario no encontrado');

    const piso = dto.piso ?? existente.piso;
    const apartamento = dto.apartamento ?? existente.apartamento;

    if (dto.piso != null || dto.apartamento != null) {
      const apt = await this.apartmentModel
        .findOne({ buildingId, piso, numero: apartamento })
        .lean()
        .exec();
      if (!apt) {
        throw new BadRequestException(`No existe el apartamento P${piso}-A${apartamento}`);
      }
    }

    if (dto.email) {
      const emailNorm = dto.email.toLowerCase().trim();
      const otro = await this.ownerModel
        .findOne({ buildingId, email: emailNorm, _id: { $ne: id } })
        .lean();
      if (otro) throw new ConflictException('Ese correo ya está en uso en este edificio');
      existente.email = emailNorm;
    }

    if (dto.nombre) existente.nombre = dto.nombre.trim();
    if (dto.rol) existente.rol = dto.rol;
    if (dto.activo != null) existente.activo = dto.activo;
    if (dto.piso != null) existente.piso = dto.piso;
    if (dto.apartamento != null) existente.apartamento = dto.apartamento;
    existente.idUnico = `P${piso}-A${apartamento}`;

    if (dto.password) {
      validatePasswordStrength(dto.password);
      existente.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    await existente.save();
    return existente.toObject() as OwnerDocument;
  }

  async deactivate(id: string, buildingId: Types.ObjectId): Promise<OwnerDocument> {
    const updated = await this.ownerModel
      .findOneAndUpdate(
        { _id: id, buildingId },
        { $set: { activo: false } },
        { new: true },
      )
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Propietario no encontrado');
    return updated as OwnerDocument;
  }

  async changePassword(
    ownerId: string,
    buildingId: Types.ObjectId,
    contraseñaActual: string,
    contraseñaNueva: string,
  ): Promise<void> {
    validatePasswordStrength(contraseñaNueva);

    const owner = await this.ownerModel.findOne({ _id: ownerId, buildingId, activo: true }).exec();
    if (!owner) throw new NotFoundException('Usuario no encontrado');

    const valid = await bcrypt.compare(contraseñaActual, owner.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');

    owner.passwordHash = await bcrypt.hash(contraseñaNueva, 10);
    await owner.save();
  }
}
