import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Abono, Recibo, ReciboDocument } from './schemas/recibo.schema';
import { CacheService } from '../common/cache.service';
import { AbonoApartamentoService } from './abono-apartamento.service';
import { CobranzaSnapshotService } from './cobranza-snapshot.service';
import { UpdateManyByMesesInput } from './recibos.types';
import { invalidarCacheListadosRecibos } from './recibos-cache.helper';
import { prepararPersistenciaBulkRecibos } from './utils/recibos-bulk-persist.util';
import { calcularAplicacionPagoConAbono } from './utils/recibos-pago-calculo.util';
import {
  filtrarRecibosConSaldo,
  sumarDeudaPendienteRecibos,
} from './utils/recibos-pendientes.util';

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
    const recibosPendientes =
      await this.cargarRecibosPendientesParaPago(params);
    if (recibosPendientes.length === 0) return { count: 0, ids: [] };

    const totalDebt = sumarDeudaPendienteRecibos(recibosPendientes);
    const abono = await this.abonoApartamentoService.getMonto(
      params.piso,
      params.apartamento,
      params.buildingId,
    );
    const { excess, amountFromAbono, totalToApply } =
      calcularAplicacionPagoConAbono(params.montoPago, totalDebt, abono);

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
    await invalidarCacheListadosRecibos(this.cacheService);
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
    const updateData: Partial<ReciboDocument> = {
      montoPagado: nuevoMontoPagado,
      abonos: [...(recibo.abonos || []), nuevoAbono],
      estado: nuevoMontoPagado >= recibo.montoUsd ? 'pagado' : 'pendiente',
    };
    const doc = await this.reciboModel
      .findByIdAndUpdate(reciboId, updateData, { new: true })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Recibo no encontrado');
    }
    await invalidarCacheListadosRecibos(this.cacheService);
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
    return this.ejecutarBulkDesdeListado(
      recibos,
      input.montoPago,
      input.paymentId,
      input.fechaPago,
      input.numeroComprobante,
    );
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
    const { count, ids } = await this.ejecutarBulkDesdeListado(
      recibos,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
    );
    return { count, ids };
  }

  private async cargarRecibosPendientesParaPago(params: {
    buildingId?: Types.ObjectId;
    piso: number;
    apartamento: number;
    recibosIds?: string[];
    meses?: number[];
  }): Promise<ReciboDocument[]> {
    if (params.recibosIds && params.recibosIds.length > 0) {
      const objectIds = params.recibosIds.map((id) => new Types.ObjectId(id));
      const q: Record<string, unknown> = { _id: { $in: objectIds } };
      if (params.buildingId) q.buildingId = params.buildingId;
      const list = await this.reciboModel.find(q).lean().exec();
      return filtrarRecibosConSaldo(list);
    }
    if (params.meses && params.meses.length > 0) {
      const q: Record<string, unknown> = {
        piso: params.piso,
        apartamento: params.apartamento,
        meses: { $in: params.meses },
      };
      if (params.buildingId) q.buildingId = params.buildingId;
      const list = await this.reciboModel.find(q).lean().exec();
      return filtrarRecibosConSaldo(list);
    }
    return [];
  }

  private async ejecutarBulkDesdeListado(
    recibos: ReciboDocument[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
  ): Promise<{ count: number; ids: string[]; abonosRegistrados: number }> {
    const prep = prepararPersistenciaBulkRecibos(
      recibos,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
    );
    if (prep.vacio) {
      return { count: 0, ids: [], abonosRegistrados: 0 };
    }
    if (prep.bulkOps.length > 0) {
      await this.reciboModel.bulkWrite(prep.bulkOps);
    }
    await invalidarCacheListadosRecibos(this.cacheService);
    return {
      count: prep.count,
      ids: prep.ids,
      abonosRegistrados: prep.abonosRegistrados,
    };
  }
}
