import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Apartment, apartmentdocument } from './schemas/apartment.schema';

// En modo multi-tenant, los apartamentos se crean por edificio via seedForBuilding.
// No hay seed global en onModuleInit — cada Building tiene su propio set de apartments.
@Injectable()
export class ApartmentsService {
  constructor(
    @InjectModel(Apartment.name) private apartmentModel: Model<apartmentdocument>,
  ) {}

  async findAll(buildingId?: Types.ObjectId): Promise<apartmentdocument[]> {
    const q: Record<string, unknown> = {};
    if (buildingId) q.buildingId = buildingId;
    return this.apartmentModel.find(q).sort({ piso: 1, numero: 1 }).lean();
  }

  async findByPiso(piso: number, buildingId?: Types.ObjectId): Promise<apartmentdocument[]> {
    const q: Record<string, unknown> = { piso };
    if (buildingId) q.buildingId = buildingId;
    return this.apartmentModel.find(q).sort({ numero: 1 }).lean();
  }

  async findByIdUnico(idUnico: string, buildingId?: Types.ObjectId): Promise<apartmentdocument | null> {
    const q: Record<string, unknown> = { idUnico };
    if (buildingId) q.buildingId = buildingId;
    return this.apartmentModel.findOne(q).lean();
  }

  // Crear seed de apartamentos para un edificio nuevo
  async seedForBuilding(buildingId: Types.ObjectId, totalPisos: number, apartamentosPorPiso: number): Promise<void> {
    const docs: Array<{ buildingId: Types.ObjectId; piso: number; numero: number; idUnico: string }> = [];
    for (let p = 1; p <= totalPisos; p++) {
      for (let a = 1; a <= apartamentosPorPiso; a++) {
        docs.push({ buildingId, piso: p, numero: a, idUnico: `P${p}-A${a}` });
      }
    }
    // insertMany con ordered: false para ignorar duplicados si ya existe
    await this.apartmentModel.insertMany(docs as Parameters<typeof this.apartmentModel.insertMany>[0], { ordered: false }).catch(() => {});
  }
}
