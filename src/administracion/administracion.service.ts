import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Recibo, ReciboDocument, Abono } from './schemas/recibo.schema';
import { FilesService } from '../files/files.service';
import { CacheService } from '../common/cache.service';
import { AbonoApartamentoService } from './abono-apartamento.service';

export type CreateReciboInput = {
  buildingId?: Types.ObjectId;
  piso: number;
  apartamento: number;
  meses: number[];
  montoUsd: number;
  tipoDeuda: string;
  fechaReportada: string;
  facturaBuffer: Buffer;
  facturaFilename: string;
  facturaMimetype?: string;
};

// Parsear fecha a mediodía UTC para evitar problemas de zona horaria
// Esto asegura que la fecha se muestre correctamente independientemente de la zona horaria
function parsearFechaLocal(fechaString: string): Date {
  const partes = fechaString.split('-');
  if (partes.length !== 3) {
    // Si no es formato YYYY-MM-DD, intentar parsear directamente
    const parsed = new Date(fechaString);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Fecha inválida: ${fechaString}`);
    }
    // Ajustar a mediodía UTC
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12, 0, 0));
  }
  const año = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const día = parseInt(partes[2], 10);
  // Crear fecha a mediodía UTC para evitar problemas de zona horaria
  return new Date(Date.UTC(año, mes, día, 12, 0, 0));
}

@Injectable()
export class AdministracionService {
  constructor(
    @InjectModel(Recibo.name) private reciboModel: Model<ReciboDocument>,
    private readonly filesService: FilesService,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly abonoApartamentoService: AbonoApartamentoService,
  ) {}

  async create(input: CreateReciboInput): Promise<ReciboDocument> {
    const idUnico = `P${input.piso}-A${input.apartamento}`;
    const fileId = await this.filesService.upload(input.facturaBuffer, {
      filename: input.facturaFilename,
      mimetype: input.facturaMimetype,
    });
    const doc = await this.reciboModel.create({
      buildingId: input.buildingId,
      piso: input.piso,
      apartamento: input.apartamento,
      idUnico,
      meses: input.meses,
      montoUsd: input.montoUsd,
      tipoDeuda: input.tipoDeuda,
      fechaReportada: parsearFechaLocal(input.fechaReportada),
      facturaFileId: fileId,
      estado: 'pendiente',
      montoPagado: 0,
      abonos: [],
    });
    const result = doc.toObject() as ReciboDocument;
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return result;
  }

  async findAll(filters: {
    buildingId?: Types.ObjectId;
    piso?: number;
    apartamento?: number;
    estado?: string;
  }): Promise<ReciboDocument[]> {
    const cacheKey = this.cacheService.generateKey('recibos', filters);
    const cached = await this.cacheService.get<ReciboDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const q: Record<string, unknown> = {};
    if (filters.buildingId) q.buildingId = filters.buildingId;
    if (filters.piso != null) q.piso = filters.piso;
    if (filters.apartamento != null) q.apartamento = filters.apartamento;
    if (filters.estado != null) q.estado = filters.estado;
    const list = await this.reciboModel
      .find(q)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const result = list as ReciboDocument[];
    await this.cacheService.set(cacheKey, result, 3 * 60 * 1000);
    return result;
  }

  async findPendientesConSaldo(filters: {
    buildingId?: Types.ObjectId;
    piso?: number;
    apartamento?: number;
  }): Promise<ReciboDocument[]> {
    const cacheKey = this.cacheService.generateKey('recibos_pendientes_saldo', filters);
    const cached = await this.cacheService.get<ReciboDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const q: Record<string, unknown> = {};
    if (filters.buildingId) q.buildingId = filters.buildingId;
    if (filters.piso != null) q.piso = filters.piso;
    if (filters.apartamento != null) q.apartamento = filters.apartamento;
    const list = await this.reciboModel
      .find(q)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const result = list.filter((recibo) => {
      const montoPagado = recibo.montoPagado || 0;
      return montoPagado < recibo.montoUsd;
    }) as ReciboDocument[];
    await this.cacheService.set(cacheKey, result, 3 * 60 * 1000);
    return result;
  }

  async findById(id: string, buildingId?: Types.ObjectId): Promise<ReciboDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const q: Record<string, unknown> = { _id: id };
    if (buildingId) q.buildingId = buildingId;
    const doc = await this.reciboModel.findOne(q).lean().exec();
    if (!doc) return null;
    return doc as ReciboDocument;
  }

  /**
   * Aplica pago aceptado con soporte de abono: exceso va a abono; si hay abono, se usa para cubrir deuda.
   * buildingId se pasa desde el pago aceptado para garantizar aislamiento entre edificios.
   */
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
      // Incluir buildingId en el query para evitar que se modifiquen recibos de otro edificio
      const q: Record<string, unknown> = { _id: { $in: objectIds } };
      if (params.buildingId) q.buildingId = params.buildingId;
      const list = await this.reciboModel.find(q).lean().exec();
      recibosPendientes = list.filter((r) => {
        const montoPagado = r.montoPagado || 0;
        return montoPagado < r.montoUsd;
      }) as ReciboDocument[];
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
      }) as ReciboDocument[];
    } else {
      return { count: 0, ids: [] };
    }
    if (recibosPendientes.length === 0) return { count: 0, ids: [] };

    const totalDebt = recibosPendientes.reduce((sum, r) => {
      const montoPagado = r.montoPagado || 0;
      return sum + (r.montoUsd - montoPagado);
    }, 0);
    const abono = await this.abonoApartamentoService.getMonto(params.piso, params.apartamento, params.buildingId);
    const amountFromPayment = Math.min(params.montoPago, totalDebt);
    const excess = Math.max(0, params.montoPago - totalDebt);
    const amountFromAbono = Math.min(abono, totalDebt - amountFromPayment);
    const totalToApply = amountFromPayment + amountFromAbono;

    if (excess > 0) {
      await this.abonoApartamentoService.agregar(params.piso, params.apartamento, excess, params.buildingId);
    }
    if (amountFromAbono > 0) {
      await this.abonoApartamentoService.consumir(params.piso, params.apartamento, amountFromAbono, params.buildingId);
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
      const { count, ids } = await this.updateManyByMeses(
        params.piso,
        params.apartamento,
        params.meses!,
        totalToApply,
        params.paymentId,
        params.fechaPago,
        params.numeroComprobante,
        params.buildingId,
      );
      result = { count, ids };
    }
    return result;
  }

  async updateEstado(id: string, estado: 'pagado'): Promise<ReciboDocument> {
    const doc = await this.reciboModel.findByIdAndUpdate(
      id,
      { estado },
      { new: true },
    ).lean().exec();
    if (!doc) {
      throw new NotFoundException('Recibo no encontrado');
    }
    const result = doc as ReciboDocument;
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return result;
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
      return recibo.toObject() as ReciboDocument;
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
    const doc = await this.reciboModel.findByIdAndUpdate(
      reciboId,
      updateData,
      { new: true },
    ).lean().exec();
    if (!doc) {
      throw new NotFoundException('Recibo no encontrado');
    }
    const result = doc as ReciboDocument;
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return result;
  }

  // Método helper privado para procesar abonos en memoria y preparar bulkWrite
  // Complejidad: O(n) - procesa recibos una vez y usa Map para acceso O(1)
  private procesarAbonosBulk(
    recibos: ReciboDocument[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
  ): {
    bulkOps: Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: any } }>;
    ids: string[];
    abonosRegistrados: number;
    recibosCompletos: Set<string>;
  } {
    const bulkOps: Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: any } }> = [];
    const ids: string[] = [];
    let abonosRegistrados = 0;
    const recibosCompletos = new Set<string>();
    let montoRestante = montoPago;
    // Map para acceso O(1) a recibos por ID
    const recibosMap = new Map<string, ReciboDocument>();
    recibos.forEach((recibo) => {
      const reciboId = (recibo._id as Types.ObjectId).toString();
      recibosMap.set(reciboId, recibo);
    });
    // Procesar recibos en orden hasta agotar el monto
    for (const recibo of recibos) {
      if (montoRestante <= 0) break;
      const reciboId = (recibo._id as Types.ObjectId).toString();
      const montoPagado = recibo.montoPagado || 0;
      const montoPendiente = recibo.montoUsd - montoPagado;
      if (montoPendiente <= 0) continue;
      const montoAAplicar = Math.min(montoRestante, montoPendiente);
      const nuevoAbono: Abono = {
        paymentId: new Types.ObjectId(paymentId),
        monto: montoAAplicar,
        fecha: fechaPago,
        numeroComprobante,
      };
      const nuevoMontoPagado = montoPagado + montoAAplicar;
      const abonosActualizados = [...(recibo.abonos || []), nuevoAbono];
      const updateData: any = {
        $set: {
          montoPagado: nuevoMontoPagado,
          abonos: abonosActualizados,
          estado: nuevoMontoPagado >= recibo.montoUsd ? 'pagado' : 'pendiente',
        },
      };
      bulkOps.push({
        updateOne: {
          filter: { _id: recibo._id as Types.ObjectId },
          update: updateData,
        },
      });
      ids.push(reciboId);
      if (montoAAplicar < montoPendiente) {
        abonosRegistrados++;
      }
      if (nuevoMontoPagado >= recibo.montoUsd) {
        recibosCompletos.add(reciboId);
      }
      montoRestante -= montoAAplicar;
    }
    return { bulkOps, ids, abonosRegistrados, recibosCompletos };
  }

  async updateManyByMeses(
    piso: number,
    apartamento: number,
    meses: number[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
    buildingId?: Types.ObjectId,
  ): Promise<{ count: number; ids: string[]; abonosRegistrados: number }> {
    // 1 query: O(n) - obtener todos los recibos de una vez
    const q: Record<string, unknown> = { piso, apartamento, meses: { $in: meses } };
    if (buildingId) q.buildingId = buildingId;
    const recibos = await this.reciboModel
      .find(q)
      .lean()
      .exec();
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
    // Procesar en memoria: O(n)
    const { bulkOps, ids, abonosRegistrados, recibosCompletos } = this.procesarAbonosBulk(
      recibosPendientes,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
    );
    // 1 operación bulk: O(n) - actualizar todos los recibos de una vez
    if (bulkOps.length > 0) {
      await this.reciboModel.bulkWrite(bulkOps);
    }
    // Contar recibos completos desde el Set: O(1)
    const count = recibosCompletos.size;
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return { count, ids, abonosRegistrados };
  }

  // Aplicar pago a recibos específicos por sus IDs
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
    // Incluir buildingId para prevenir modificación cruzada entre tenants
    const q: Record<string, unknown> = { _id: { $in: objectIds } };
    if (buildingId) q.buildingId = buildingId;
    const recibos = await this.reciboModel
      .find(q)
      .lean()
      .exec();
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
    // Procesar en memoria: O(n)
    const { bulkOps, ids, recibosCompletos } = this.procesarAbonosBulk(
      recibosPendientes,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
    );
    // 1 operación bulk: O(n) - actualizar todos los recibos de una vez
    if (bulkOps.length > 0) {
      await this.reciboModel.bulkWrite(bulkOps);
    }
    const count = recibosCompletos.size;
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return { count, ids };
  }
}