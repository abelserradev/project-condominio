import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment, paymentdocument } from './schemas/payment.schema';
import { FilesService } from '../files/files.service';
import { AdministracionService } from '../administracion/administracion.service';
import { CacheService } from '../common/cache.service';
import { OcrService } from '../ocr/ocr.service';
import type { ComprobanteExtractionDto } from '../ocr/dto/comprobante-extraction.dto';
import * as crypto from 'crypto';

// Parsear fecha a mediodía UTC para evitar problemas de zona horaria
function parsearFechaPago(fechaString: string): Date {
  const partes = fechaString.split('-');
  if (partes.length !== 3) {
    const parsed = new Date(fechaString);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Fecha inválida: ${fechaString}`);
    }
    return new Date(
      Date.UTC(
        parsed.getUTCFullYear(),
        parsed.getUTCMonth(),
        parsed.getUTCDate(),
        12,
        0,
        0,
      ),
    );
  }
  const año = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10) - 1;
  const día = parseInt(partes[2], 10);
  return new Date(Date.UTC(año, mes, día, 12, 0, 0));
}

export type CreatePaymentInput = {
  buildingId?: Types.ObjectId;
  piso: number;
  apartamento: number;
  meses: number[];
  banco: string;
  fechaPago: string;
  numeroComprobante: string;
  montoUsd: number;
  montoBs?: number;
  tasaBcv?: number;
  comprobanteBuffer: Buffer;
  comprobanteFilename: string;
  comprobanteMimetype?: string;
  recibosIds?: string[];
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<paymentdocument>,
    private readonly filesService: FilesService,
    @Inject(forwardRef(() => AdministracionService))
    private readonly administracionService: AdministracionService,
    @Inject(CacheService) private readonly cacheService: CacheService,
    private readonly ocrService: OcrService,
  ) {}

  async create(input: CreatePaymentInput): Promise<paymentdocument> {
    const idUnico = `P${input.piso}-A${input.apartamento}`;
    const fileId = await this.filesService.upload(input.comprobanteBuffer, {
      filename: input.comprobanteFilename,
      mimetype: input.comprobanteMimetype,
    });
    // Si se proporcionan recibosIds, guardarlos en el pago para usarlos cuando se acepte
    const recibosIdsObjectIds = input.recibosIds?.map(
      (id) => new Types.ObjectId(id),
    );

    const doc = await this.paymentModel.create({
      buildingId: input.buildingId,
      piso: input.piso,
      apartamento: input.apartamento,
      idUnico,
      meses: input.meses,
      banco: input.banco,
      fechaPago: parsearFechaPago(input.fechaPago),
      numeroComprobante: input.numeroComprobante,
      montoUsd: input.montoUsd,
      montoBs: input.montoBs,
      tasaBcv: input.tasaBcv,
      comprobanteFileId: fileId,
      estado: 'pendiente',
      recibosPagados: recibosIdsObjectIds || [],
    });

    // --- Inicia Lógica de Aprendizaje OCR ---
    try {
      const fileHash = crypto
        .createHash('sha256')
        .update(input.comprobanteBuffer)
        .digest('hex');
      const prediccionOcr = await this.cacheService.get<
        Pick<
          ComprobanteExtractionDto,
          'banco' | 'montoBs' | 'fechaPago' | 'numeroComprobante'
        >
      >(`ocr_pred:${fileHash}`);
      if (prediccionOcr) {
        await this.ocrService.registrarOcrLog(
          fileId.toString(),
          prediccionOcr,
          {
            banco: input.banco,
            montoBs: input.montoBs,
            fechaPago: input.fechaPago,
            numeroComprobante: input.numeroComprobante,
          },
        );
        await this.cacheService.delete(`ocr_pred:${fileHash}`); // Limpiar ya fue consumido
      }
    } catch (err) {
      console.warn('Error enlazando OCR log:', err);
    }
    // --- Fin Lógica de Aprendizaje OCR ---

    const result = doc.toObject();
    await this.cacheService.deletePattern(`payments:.*`);
    return result;
  }

  async findAll(filters: {
    buildingId?: Types.ObjectId;
    piso?: number;
    apartamento?: number;
    estado?: string;
  }): Promise<paymentdocument[]> {
    const cacheKey = this.cacheService.generateKey('payments', filters);
    const cached = await this.cacheService.get<paymentdocument[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const q: Record<string, unknown> = {};
    if (filters.buildingId) q.buildingId = filters.buildingId;
    if (filters.piso != null) q.piso = filters.piso;
    if (filters.apartamento != null) q.apartamento = filters.apartamento;
    if (filters.estado != null) q.estado = filters.estado;
    const list = await this.paymentModel
      .find(q)
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    const result = list as paymentdocument[];
    await this.cacheService.set(cacheKey, result, 3 * 60 * 1000);
    return result;
  }

  async findById(
    id: string,
    buildingId?: Types.ObjectId,
  ): Promise<paymentdocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const q: Record<string, unknown> = { _id: id };
    if (buildingId) q.buildingId = buildingId;
    const doc = await this.paymentModel.findOne(q).lean().exec();
    if (!doc) return null;
    return doc;
  }

  async updateEstado(
    id: string,
    estado: 'aceptado' | 'rechazado',
    buildingId: Types.ObjectId,
  ): Promise<paymentdocument> {
    const doc = await this.paymentModel
      .findOneAndUpdate({ _id: id, buildingId }, { estado }, { new: true })
      .lean()
      .exec();
    if (!doc) {
      throw new NotFoundException('Pago no encontrado');
    }
    const pagoDoc = doc;
    if (estado === 'aceptado') {
      const paymentId = doc._id.toString();
      const fechaPago =
        pagoDoc.fechaPago instanceof Date
          ? pagoDoc.fechaPago
          : new Date(pagoDoc.fechaPago);

      const { ids } = await this.administracionService.applyPagoAceptado({
        buildingId: pagoDoc.buildingId,
        piso: pagoDoc.piso,
        apartamento: pagoDoc.apartamento,
        recibosIds: pagoDoc.recibosPagados?.length
          ? pagoDoc.recibosPagados.map((id) => id.toString())
          : undefined,
        meses: !pagoDoc.recibosPagados?.length
          ? pagoDoc.meses || []
          : undefined,
        montoPago: pagoDoc.montoUsd,
        paymentId,
        fechaPago,
        numeroComprobante: pagoDoc.numeroComprobante,
      });

      if (ids.length > 0) {
        const recibosIds = ids.map((id) => new Types.ObjectId(id));
        await this.paymentModel
          .findByIdAndUpdate(id, { recibosPagados: recibosIds }, { new: true })
          .exec();
      }
    }
    await this.cacheService.deletePattern(`payments:.*`);
    await this.cacheService.deletePattern(`recibos:.*`);
    await this.cacheService.deletePattern(`recibos_pendientes_saldo:.*`);
    return pagoDoc;
  }
}
