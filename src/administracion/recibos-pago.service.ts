import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Abono, Recibo, ReciboDocument } from './schemas/recibo.schema';
import { CacheService } from '../common/cache.service';
import { AbonoApartamentoService } from './abono-apartamento.service';
import { CobranzaSnapshotService } from './cobranza-snapshot.service';
import { UpdateManyByMesesInput } from './recibos.types';
import { prepararBulkAbonosRecibos } from './utils/recibos-abono-bulk.util';

@Injectable()
export class RecibosPagoService {
  constructor(
    @InjectModel(Recibo.name)
    private readonly reciboModel: Model<ReciboDocument>,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly abonoApartamentoService: AbonoApartamentoService,
    private readonly cobranzaSnapshotService: CobranzaSnapshotService,
  ) {}

  async applyPagoAceptado(params: {
    buildingId?: Types.ObjectId;
    piso: number;
    apartamento: number;
    recibosIds?: string[];
    meses?: number[];
    montoPago: number;
    paymentId: string;
    fechaPago: Date;
    numeroComprobante?: string;
  }): Promise<{ count: number; ids: string[] }> {
    let recibosPendientes: ReciboDocument[];
    if (params.recibosIds && params.recibosIds.length > 0) {
      const objectIds = params.recibosIds.map((id) => new Types.ObjectId(id));
      const q: Record<string, unknown> = { _id: { $in: objectIds } };
      if (params.buildingId) q.buildingId = params.buildingId;
      const list = await this.reciboModel.find(q).lean().exec();
      recibosPendientes = list.filter((r) => {
        const montoPagado = r.montoPagado || 0;
        return montoPagado < r.montoUsd;
      });
    } else if (params.meses && params.meses.length > 0) {
      const q: Record<string, unknown> = {
        piso: params.piso,
        apartamento: params.apartamento,
        meses: { $in: params.meses },
      };
      if (params.buildingId) q.buildingId = params.buildingId;
      const list = await this.reciboModel.find(q).lean().exec();
      recibosPendientes = list.filter((r) => {
        const montoPagado = r.montoPagado || 0;
        return montoPagado < r.montoUsd;
      });
    } else {
      return { count: 0, ids: [] };
    }
    if (recibosPendientes.length === 0) return { count: 0, ids: [] };

    const totalDebt = recibosPendientes.reduce((sum, r) => {
      const montoPagado = r.montoPagado || 0;
      return sum + (r.montoUsd - montoPagado);
    }, 0);
    const abono = await this.abonoApartamentoService.getMonto(
      params.piso,
      params.apartamento,
      params.buildingId,
    );
    const amountFromPayment = Math.min(params.montoPago, totalDebt);
    const excess = Math.max(0, params.montoPago - totalDebt);
    const amountFromAbono = Math.min(abono, totalDebt - amountFromPayment);
    const totalToApply = amountFromPayment + amountFromAbono;

    if (excess > 0) {
      await this.abonoApartamentoService.agregar(
        params.piso,
        params.apartamento,
        excess,
        params.buildingId,
      );
    }
    if (amountFromAbono > 0) {
      await this.abonoApartamentoService.consumir(
        params.piso,
        params.apartamento,
        amountFromAbono,
        params.buildingId,
      );
    }

    let result: { count: number; ids: string[] };
    if (params.recibosIds && params.recibosIds.length > 0) {
      result = await this.updateManyByIds(
        params.recibosIds,
        totalToApply,
        params.paymentId,
        params.fechaPago,
        params.numeroComprobante,
        params.buildingId,
      );
    } else {
      const { count, ids } = await this.updateManyByMeses({
        buildingId: params.buildingId,
        piso: params.piso,
        apartamento: params.apartamento,
        meses: params.meses!,
        montoPago: totalToApply,
        paymentId: params.paymentId,
        fechaPago: params.fechaPago,
        numeroComprobante: params.numeroComprobante,
      });
      result = { count, ids };
    }
    if (params.buildingId) {
      this.cobranzaSnapshotService.programarRebuild(params.buildingId);
    }
    return result;
  }

  async updateEstado(id: string, estado: 'pagado'): Promise<ReciboDocument> {
    const doc = await this.reciboModel
      .findByIdAndUpdate(id, { estado }, { new: true })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Recibo no encontrado');
    }
    await this.invalidarCacheRecibos();
    return doc;
  }

  async registrarAbono(
    reciboId: string,
    paymentId: string,
    monto: number,
    fecha: Date,
    numeroComprobante?: string,
  ): Promise<ReciboDocument> {
    const recibo = await this.reciboModel.findById(reciboId).exec();
    if (!recibo) {
      throw new NotFoundException('Recibo no encontrado');
    }
    const montoPagadoActual = recibo.montoPagado || 0;
    const montoPendiente = recibo.montoUsd - montoPagadoActual;
    if (montoPendiente <= 0) {
      return recibo.toObject();
    }
    const montoAAplicar = Math.min(monto, montoPendiente);
    const nuevoAbono: Abono = {
      paymentId: new Types.ObjectId(paymentId),
      monto: montoAAplicar,
      fecha,
      numeroComprobante,
    };
    const nuevoMontoPagado = montoPagadoActual + montoAAplicar;
    const abonosActualizados = [...(recibo.abonos || []), nuevoAbono];
    const updateData: Partial<ReciboDocument> = {
      montoPagado: nuevoMontoPagado,
      abonos: abonosActualizados,
    };
    if (nuevoMontoPagado >= recibo.montoUsd) {
      updateData.estado = 'pagado';
    } else {
      updateData.estado = 'pendiente';
    }
    const doc = await this.reciboModel
      .findByIdAndUpdate(reciboId, updateData, { new: true })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Recibo no encontrado');
    }
    await this.invalidarCacheRecibos();
    return doc;
  }

  async updateManyByMeses(
    input: UpdateManyByMesesInput,
  ): Promise<{ count: number; ids: string[]; abonosRegistrados: number }> {
    const q: Record<string, unknown> = {
      piso: input.piso,
      apartamento: input.apartamento,
      meses: { $in: input.meses },
    };
    if (input.buildingId) q.buildingId = input.buildingId;
    const recibos = await this.reciboModel.find(q).lean().exec();
    if (recibos.length === 0) {
      return { count: 0, ids: [], abonosRegistrados: 0 };
    }
    const recibosPendientes = recibos.filter((recibo) => {
      const montoPagado = recibo.montoPagado || 0;
      return montoPagado < recibo.montoUsd;
    });
    if (recibosPendientes.length === 0) {
      return { count: 0, ids: [], abonosRegistrados: 0 };
    }
    const { bulkOps, ids, abonosRegistrados, recibosCompletos } =
      prepararBulkAbonosRecibos(
        recibosPendientes,
        input.montoPago,
        input.paymentId,
        input.fechaPago,
        input.numeroComprobante,
      );
    if (bulkOps.length > 0) {
      await this.reciboModel.bulkWrite(bulkOps);
    }
    const count = recibosCompletos.size;
    await this.invalidarCacheRecibos();
    return { count, ids, abonosRegistrados };
  }

  async updateManyByIds(
    recibosIds: string[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
    buildingId?: Types.ObjectId,
  ): Promise<{ count: number; ids: string[] }> {
    if (recibosIds.length === 0) {
      return { count: 0, ids: [] };
    }
    const objectIds = recibosIds.map((id) => new Types.ObjectId(id));
    const q: Record<string, unknown> = { _id: { $in: objectIds } };
    if (buildingId) q.buildingId = buildingId;
    const recibos = await this.reciboModel.find(q).lean().exec();
    if (recibos.length === 0) {
      return { count: 0, ids: [] };
    }
    const recibosPendientes = recibos.filter((recibo) => {
      const montoPagado = recibo.montoPagado || 0;
      return montoPagado < recibo.montoUsd;
    });
    if (recibosPendientes.length === 0) {
      return { count: 0, ids: [] };
    }
    const { bulkOps, ids, recibosCompletos } = prepararBulkAbonosRecibos(
      recibosPendientes,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
    );
    if (bulkOps.length > 0) {
      await this.reciboModel.bulkWrite(bulkOps);
    }
    const count = recibosCompletos.size;
    await this.invalidarCacheRecibos();
    return { count, ids };
  }

  private async invalidarCacheRecibos(): Promise<void> {
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
  }
}
