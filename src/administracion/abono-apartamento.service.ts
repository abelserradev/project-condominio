import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AbonoApartamento, AbonoApartamentoDocument } from './schemas/abono-apartamento.schema';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AbonoApartamentoService {
  constructor(
    @InjectModel(AbonoApartamento.name) private abonoModel: Model<AbonoApartamentoDocument>,
    private readonly cacheService: CacheService,
  ) {}

  async getMonto(piso: number, apartamento: number, buildingId?: Types.ObjectId): Promise<number> {
    const cacheKey = `abono:${buildingId?.toString() ?? 'global'}:${piso}:${apartamento}`;
    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== undefined && cached !== null) return cached;

    const query: Record<string, unknown> = { piso, apartamento };
    if (buildingId) query.buildingId = buildingId;

    const doc = await this.abonoModel.findOne(query).lean().exec();
    const monto = doc?.monto ?? 0;
    await this.cacheService.set(cacheKey, monto, 60 * 1000);
    return monto;
  }

  async agregar(piso: number, apartamento: number, monto: number, buildingId?: Types.ObjectId): Promise<void> {
    if (monto <= 0) return;

    const filter: Record<string, unknown> = { piso, apartamento };
    if (buildingId) filter.buildingId = buildingId;

    await this.abonoModel.findOneAndUpdate(
      filter,
      { $inc: { monto }, ...(buildingId && { $setOnInsert: { buildingId } }) },
      { upsert: true, new: true },
    ).exec();
    await this.invalidarCache(piso, apartamento, buildingId);
  }

  async consumir(piso: number, apartamento: number, monto: number, buildingId?: Types.ObjectId): Promise<number> {
    if (monto <= 0) return 0;

    const filter: Record<string, unknown> = { piso, apartamento };
    if (buildingId) filter.buildingId = buildingId;

    const doc = await this.abonoModel.findOne(filter).exec();
    if (!doc) return 0;

    const aConsumir = Math.min(doc.monto, monto);
    if (aConsumir <= 0) return 0;

    doc.monto -= aConsumir;
    await doc.save();
    await this.invalidarCache(piso, apartamento, buildingId);
    return aConsumir;
  }

  private async invalidarCache(piso: number, apartamento: number, buildingId?: Types.ObjectId): Promise<void> {
    await this.cacheService.delete(`abono:${buildingId?.toString() ?? 'global'}:${piso}:${apartamento}`);
  }
}
