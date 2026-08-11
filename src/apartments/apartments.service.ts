import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Apartment, apartmentdocument } from './schemas/apartment.schema';

// En modo multi-tenant, los apartamentos se crean por edificio via seedForBuilding.
// No hay seed global en onModuleInit — cada Building tiene su propio set de apartments.
@Injectable()
export class ApartmentsService {
  constructor(
    @InjectModel(Apartment.name)
    private readonly apartmentModel: Model<apartmentdocument>,
  ) {}

  async findAll(buildingId?: Types.ObjectId): Promise<apartmentdocument[]> {
    const q: Record<string, unknown> = {};
    if (buildingId) q.buildingId = buildingId;
    return this.apartmentModel.find(q).sort({ piso: 1, numero: 1 }).lean();
  }

  async findByPiso(
    piso: number,
    buildingId?: Types.ObjectId,
  ): Promise<apartmentdocument[]> {
    const q: Record<string, unknown> = { piso };
    if (buildingId) q.buildingId = buildingId;
    return this.apartmentModel.find(q).sort({ numero: 1 }).lean();
  }

  async findByIdUnico(
    idUnico: string,
    buildingId?: Types.ObjectId,
  ): Promise<apartmentdocument | null> {
    const q: Record<string, unknown> = { idUnico };
    if (buildingId) q.buildingId = buildingId;
    return this.apartmentModel.findOne(q).lean();
  }

  // Crear seed de apartamentos para un edificio nuevo
  async seedForBuilding(
    buildingId: Types.ObjectId,
    totalPisos: number,
    apartamentosPorPiso: number,
  ): Promise<void> {
    const docs: Array<{
      buildingId: Types.ObjectId;
      piso: number;
      numero: number;
      idUnico: string;
    }> = [];
    for (let p = 1; p <= totalPisos; p++) {
      for (let a = 1; a <= apartamentosPorPiso; a++) {
        docs.push({ buildingId, piso: p, numero: a, idUnico: `P${p}-A${a}` });
      }
    }
    // insertMany con ordered: false para ignorar duplicados si ya existe
    let insertedCount = 0;
    let seedError: string | null = null;
    try {
      const result = await this.apartmentModel.insertMany(
        docs as Parameters<typeof this.apartmentModel.insertMany>[0],
        { ordered: false },
      );
      insertedCount = result.length;
    } catch (err: unknown) {
      const mongoErr = err as { code?: number; writeErrors?: unknown[] };
      if (mongoErr.code === 11000) {
        insertedCount = docs.length - (mongoErr.writeErrors?.length ?? 0);
      } else {
        seedError = err instanceof Error ? err.message : String(err);
        throw err;
      }
    }
    // #region agent log
    fetch('http://127.0.0.1:7770/ingest/8d24192f-e050-43eb-bac5-e21e3ba0ea2e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'5c886b'},body:JSON.stringify({sessionId:'5c886b',runId:'pre-fix',hypothesisId:'H2',location:'apartments.service.ts:seedForBuilding',message:'Seed apartamentos',data:{buildingId:buildingId.toString(),totalPisos,apartamentosPorPiso,expectedDocs:docs.length,insertedCount,seedError},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }
}
