import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Recibo, ReciboDocument } from './schemas/recibo.schema';
import { FilesService } from '../files/files.service';
import { CacheService } from '../common/cache.service';
import { CobranzaSnapshotService } from './cobranza-snapshot.service';
import { CreateReciboInput } from './recibos.types';
import { parsearFechaReciboUtc } from './recibos-fecha.util';
import { invalidarCacheListadosRecibos } from './recibos-cache.helper';

@Injectable()
export class RecibosService {
  constructor(
    @InjectModel(Recibo.name)
    private readonly reciboModel: Model<ReciboDocument>,
    private readonly filesService: FilesService,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly cobranzaSnapshotService: CobranzaSnapshotService,
  ) {}

  async create(input: CreateReciboInput): Promise<ReciboDocument> {
    const idUnico = `P${input.piso}-A${input.apartamento}`;
    let fileId: Types.ObjectId | undefined;
    if (input.facturaBuffer) {
      fileId = await this.filesService.upload(input.facturaBuffer, {
        filename: input.facturaFilename ?? idUnico,
        mimetype: input.facturaMimetype,
      });
    } else if (input.facturaFileId) {
      fileId = new Types.ObjectId(input.facturaFileId);
    }
    const doc = await this.reciboModel.create({
      buildingId: input.buildingId,
      piso: input.piso,
      apartamento: input.apartamento,
      idUnico,
      meses: input.meses,
      montoUsd: input.montoUsd,
      tipoDeuda: input.tipoDeuda,
      fechaReportada: parsearFechaReciboUtc(input.fechaReportada),
      facturaFileId: fileId,
      estado: 'pendiente',
      montoPagado: 0,
      abonos: [],
    });
    const result = doc.toObject();
    await invalidarCacheListadosRecibos(this.cacheService);
    if (input.buildingId) {
      this.cobranzaSnapshotService.programarRebuild(input.buildingId);
    }
    return result;
  }

  async uploadFacturaFile(
    buffer: Buffer,
    filename: string,
    mimetype?: string,
  ): Promise<string> {
    const id = await this.filesService.upload(buffer, {
      filename,
      mimetype,
    });
    return id.toString();
  }

  async findPendientesByApto(
    piso: number,
    apartamento: number,
    buildingId?: Types.ObjectId,
  ): Promise<ReciboDocument[]> {
    return this.findPendientesConSaldo({ buildingId, piso, apartamento });
  }

  async createReciboFromForm(
    input: CreateReciboInput,
  ): Promise<ReciboDocument> {
    return this.create(input);
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
    const cacheKey = this.cacheService.generateKey(
      'recibos_pendientes_saldo',
      filters,
    );
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

  async findById(
    id: string,
    buildingId?: Types.ObjectId,
  ): Promise<ReciboDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const q: Record<string, unknown> = { _id: id };
    if (buildingId) q.buildingId = buildingId;
    const doc = await this.reciboModel.findOne(q).lean().exec();
    if (!doc) return null;
    return doc;
  }
}
