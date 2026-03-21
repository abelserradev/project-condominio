import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbonoApartamento, AbonoApartamentoDocument } from './schemas/abono-apartamento.schema';
import { CacheService } from '../common/cache.service';

@Injectable()
export class AbonoApartamentoService {
  constructor(
    @InjectModel(AbonoApartamento.name) private abonoModel: Model<AbonoApartamentoDocument>,
    private readonly cacheService: CacheService,
  ) {}

  async getMonto(piso: number, apartamento: number): Promise<number> {
    const cacheKey = `abono:${piso}:${apartamento}`;
    const cached = await this.cacheService.get<number>(cacheKey);
    if (cached !== undefined && cached !== null) return cached;
    const doc = await this.abonoModel.findOne({ piso, apartamento }).lean().exec();
    const monto = doc?.monto ?? 0;
    await this.cacheService.set(cacheKey, monto, 60 * 1000);
    return monto;
  }

  async agregar(piso: number, apartamento: number, monto: number): Promise<void> {
    if (monto <= 0) return;
    await this.abonoModel.findOneAndUpdate(
      { piso, apartamento },
      { $inc: { monto } },
      { upsert: true, new: true },
    ).exec();
    await this.invalidarCache(piso, apartamento);
  }

  async consumir(piso: number, apartamento: number, monto: number): Promise<number> {
    if (monto <= 0) return 0;
    const doc = await this.abonoModel.findOne({ piso, apartamento }).exec();
    if (!doc) return 0;
    const aConsumir = Math.min(doc.monto, monto);
    if (aConsumir <= 0) return 0;
    doc.monto -= aConsumir;
    await doc.save();
    await this.invalidarCache(piso, apartamento);
    return aConsumir;
  }

  private async invalidarCache(piso: number, apartamento: number): Promise<void> {
    await this.cacheService.delete(`abono:${piso}:${apartamento}`);
  }
}
