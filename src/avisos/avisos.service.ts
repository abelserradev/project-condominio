import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Aviso, AvisoDocument } from './schemas/aviso.schema';
import { CreateAvisoDto } from './dto/create-aviso.dto';
import { UpdateAvisoDto } from './dto/update-aviso.dto';

@Injectable()
export class AvisosService {
    constructor(
        @InjectModel(Aviso.name) private avisoModel: Model<AvisoDocument>,
    ) {}

    async findAll(): Promise<AvisoDocument[]> {
        return this.avisoModel
            .find()
            .sort({ createdAt: -1 })
            .lean()
            .exec();
    }

    private validateObjectId(id: string): Types.ObjectId {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException(`ID de aviso inválido: ${id}`);
        }
        return new Types.ObjectId(id);
    }

    async findOne(id: string): Promise<AvisoDocument | null> {
        const objectId = this.validateObjectId(id);
        return this.avisoModel.findOne({ _id: objectId }).lean().exec();
    }

    async create(dto: CreateAvisoDto): Promise<AvisoDocument> {
        const doc = new this.avisoModel({
            titulo: dto.titulo.trim(),
            mensaje: dto.mensaje.trim(),
            tipo: dto.tipo,
            prioridad: dto.prioridad ?? 'media',
            estado: dto.estado ?? 'borrador',
        });
        return doc.save();
    }

    async update(id: string, dto: UpdateAvisoDto): Promise<AvisoDocument | null> {
        const objectId = this.validateObjectId(id);
        const update: Record<string, unknown> = {};
        if (dto.titulo !== undefined) update.titulo = dto.titulo.trim();
        if (dto.mensaje !== undefined) update.mensaje = dto.mensaje.trim();
        if (dto.tipo !== undefined) update.tipo = dto.tipo;
        if (dto.prioridad !== undefined) update.prioridad = dto.prioridad;
        if (dto.estado !== undefined) update.estado = dto.estado;
        if (Object.keys(update).length === 0) {
            return this.avisoModel.findOne({ _id: objectId }).lean().exec();
        }
        const doc = await this.avisoModel
            .findOneAndUpdate({ _id: objectId }, { $set: update }, { new: true })
            .lean()
            .exec();
        return doc ?? null;
    }

    async remove(id: string): Promise<void> {
        const objectId = this.validateObjectId(id);
        const result = await this.avisoModel.findOneAndDelete({ _id: objectId }).exec();
        if (!result) {
            throw new NotFoundException(`Aviso con id ${id} no encontrado`);
        }
    }
}