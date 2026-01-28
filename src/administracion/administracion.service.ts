import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Recibo, ReciboDocument, Abono } from './schemas/recibo.schema';
import { FilesService } from '../files/files.service';
import { CacheService } from '../common/cache.service';

export type CreateReciboInput = {
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
  ) {}

  async create(input: CreateReciboInput): Promise<ReciboDocument> {
    const idUnico = `P${input.piso}-A${input.apartamento}`;
    const fileId = await this.filesService.upload(input.facturaBuffer, {
      filename: input.facturaFilename,
      mimetype: input.facturaMimetype,
    });
    const doc = await this.reciboModel.create({
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
    this.cacheService.deletePattern(`recibos:.*`);
    this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return result;
  }

  async findAll(filters: {
    piso?: number;
    apartamento?: number;
    estado?: string;
  }): Promise<ReciboDocument[]> {
    const cacheKey = this.cacheService.generateKey('recibos', filters);
    const cached = this.cacheService.get<ReciboDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const q: Record<string, number | string> = {};
    if (filters.piso != null) q.piso = filters.piso;
    if (filters.apartamento != null) q.apartamento = filters.apartamento;
    if (filters.estado != null) q.estado = filters.estado;
    const list = await this.reciboModel
      .find(q)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const result = list as ReciboDocument[];
    this.cacheService.set(cacheKey, result, 3 * 60 * 1000);
    return result;
  }

  async findPendientesConSaldo(filters: {
    piso?: number;
    apartamento?: number;
  }): Promise<ReciboDocument[]> {
    const cacheKey = this.cacheService.generateKey('recibos_pendientes_saldo', filters);
    const cached = this.cacheService.get<ReciboDocument[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const q: Record<string, number> = {};
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
    this.cacheService.set(cacheKey, result, 3 * 60 * 1000);
    return result;
  }

  async findById(id: string): Promise<ReciboDocument | null> {
    const doc = await this.reciboModel.findById(id).lean().exec();
    if (!doc) return null;
    return doc as ReciboDocument;
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
    this.cacheService.deletePattern(`recibos:.*`);
    this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
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
    this.cacheService.deletePattern(`recibos:.*`);
    this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return result;
  }

  async updateManyByMeses(
    piso: number,
    apartamento: number,
    meses: number[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
  ): Promise<{ count: number; ids: string[]; abonosRegistrados: number }> {
    const recibos = await this.reciboModel
      .find({
        piso,
        apartamento,
        meses: { $in: meses },
      })
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
    const ids: string[] = [];
    let abonosRegistrados = 0;
    let montoRestante = montoPago;
    for (const recibo of recibosPendientes) {
      if (montoRestante <= 0) break;
      const reciboId = (recibo._id as Types.ObjectId).toString();
      const montoPagado = recibo.montoPagado || 0;
      const montoPendiente = recibo.montoUsd - montoPagado;
      if (montoPendiente <= 0) continue;
      const montoAAplicar = Math.min(montoRestante, montoPendiente);
      await this.registrarAbono(
        reciboId,
        paymentId,
        montoAAplicar,
        fechaPago,
        numeroComprobante,
      );
      ids.push(reciboId);
      if (montoAAplicar < montoPendiente) {
        abonosRegistrados++;
      }
      montoRestante -= montoAAplicar;
    }
    const recibosCompletos = await this.reciboModel
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        estado: 'pagado',
      })
      .countDocuments()
      .exec();
    return { count: recibosCompletos, ids, abonosRegistrados };
  }

  // Aplicar pago a recibos específicos por sus IDs
  async updateManyByIds(
    recibosIds: string[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
  ): Promise<{ count: number; ids: string[] }> {
    if (recibosIds.length === 0) {
      return { count: 0, ids: [] };
    }
    const objectIds = recibosIds.map((id) => new Types.ObjectId(id));
    const recibos = await this.reciboModel
      .find({
        _id: { $in: objectIds },
      })
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
    const ids: string[] = [];
    let montoRestante = montoPago;
    for (const recibo of recibosPendientes) {
      if (montoRestante <= 0) break;
      const reciboId = (recibo._id as Types.ObjectId).toString();
      const montoPagado = recibo.montoPagado || 0;
      const montoPendiente = recibo.montoUsd - montoPagado;
      if (montoPendiente <= 0) continue;
      const montoAAplicar = Math.min(montoRestante, montoPendiente);
      await this.registrarAbono(
        reciboId,
        paymentId,
        montoAAplicar,
        fechaPago,
        numeroComprobante,
      );
      ids.push(reciboId);
      montoRestante -= montoAAplicar;
    }
    this.cacheService.deletePattern(`recibos:.*`);
    this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return { count: ids.length, ids };
  }
}
