import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, paymentdocument } from './schemas/payment.schema';
import { FilesService } from '../files/files.service';

export type CreatePaymentInput = {
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
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<paymentdocument>,
    private readonly filesService: FilesService,
  ) {}

  async create(input: CreatePaymentInput): Promise<paymentdocument> {
    const idUnico = `P${input.piso}-A${input.apartamento}`;
    const fileId = await this.filesService.upload(input.comprobanteBuffer, {
      filename: input.comprobanteFilename,
      mimetype: input.comprobanteMimetype,
    });
    const doc = await this.paymentModel.create({
      piso: input.piso,
      apartamento: input.apartamento,
      idUnico,
      meses: input.meses,
      banco: input.banco,
      fechaPago: new Date(input.fechaPago),
      numeroComprobante: input.numeroComprobante,
      montoUsd: input.montoUsd,
      montoBs: input.montoBs,
      tasaBcv: input.tasaBcv,
      comprobanteFileId: fileId,
      estado: 'pendiente',
    });
    return doc.toObject() as paymentdocument;
  }

  async findAll(filters: {
    piso?: number;
    apartamento?: number;
    estado?: string;
  }): Promise<paymentdocument[]> {
    console.log('[PaymentsService] findAll con filtros:', JSON.stringify(filters));
    const q: Record<string, number | string> = {};
    if (filters.piso != null) q.piso = filters.piso;
    if (filters.apartamento != null) q.apartamento = filters.apartamento;
    if (filters.estado != null) q.estado = filters.estado;
    console.log('[PaymentsService] query construida:', JSON.stringify(q));
    const list = await this.paymentModel
      .find(q)
      .sort({ createdAt: -1 })
      .lean();
    console.log(`[PaymentsService] findAll encontrados ${list.length} pagos`);
    return list as paymentdocument[];
  }

  async findById(id: string): Promise<paymentdocument | null> {
    console.log('[PaymentsService] findById llamado con id:', id);
    try {
      const doc = await this.paymentModel.findById(id).lean();
      if (!doc) {
        console.log('[PaymentsService] findById: pago no encontrado para id:', id);
        return null;
      }
      console.log('[PaymentsService] findById: pago encontrado:', {
        _id: doc._id,
        piso: doc.piso,
        apartamento: doc.apartamento,
        estado: (doc as unknown as { estado?: string }).estado,
      });
      return doc as paymentdocument;
    } catch (err) {
      console.error('[PaymentsService] findById error:', err);
      throw err;
    }
  }

  async updateEstado(id: string, estado: 'aceptado' | 'rechazado'): Promise<paymentdocument> {
    console.log('[PaymentsService] updateEstado llamado con id:', id, 'estado:', estado);
    try {
      const doc = await this.paymentModel.findByIdAndUpdate(
        id,
        { estado },
        { new: true },
      ).lean();
      if (!doc) {
        console.log('[PaymentsService] updateEstado: pago no encontrado para id:', id);
        throw new NotFoundException('Pago no encontrado');
      }
      console.log('[PaymentsService] updateEstado: pago actualizado exitosamente:', {
        _id: doc._id,
        nuevoEstado: (doc as unknown as { estado?: string }).estado,
      });
      return doc as paymentdocument;
    } catch (err) {
      console.error('[PaymentsService] updateEstado error:', err);
      throw err;
    }
  }
}