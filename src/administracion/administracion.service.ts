import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { ReciboDocument } from './schemas/recibo.schema';
import { RecibosService } from './recibos.service';
import { RecibosPagoService } from './recibos-pago.service';
import { CreateReciboInput, UpdateManyByMesesInput } from './recibos.types';

export type {
  CreateReciboInput,
  UpdateManyByMesesInput,
} from './recibos.types';

/** Fachada estable para controller y payments mientras Phase 4 separa cohesión de recibos */
@Injectable()
export class AdministracionService {
  constructor(
    private readonly recibosService: RecibosService,
    private readonly recibosPagoService: RecibosPagoService,
  ) {}

  async create(input: CreateReciboInput): Promise<ReciboDocument> {
    return this.recibosService.create(input);
  }

  async uploadFacturaFile(
    buffer: Buffer,
    filename: string,
    mimetype?: string,
  ): Promise<string> {
    return this.recibosService.uploadFacturaFile(buffer, filename, mimetype);
  }

  async findPendientesByApto(
    piso: number,
    apartamento: number,
    buildingId?: Types.ObjectId,
  ): Promise<ReciboDocument[]> {
    return this.recibosService.findPendientesByApto(
      piso,
      apartamento,
      buildingId,
    );
  }

  async createReciboFromForm(
    input: CreateReciboInput,
  ): Promise<ReciboDocument> {
    return this.recibosService.createReciboFromForm(input);
  }

  async findAll(filters: {
    buildingId?: Types.ObjectId;
    piso?: number;
    apartamento?: number;
    estado?: string;
  }): Promise<ReciboDocument[]> {
    return this.recibosService.findAll(filters);
  }

  async findPendientesConSaldo(filters: {
    buildingId?: Types.ObjectId;
    piso?: number;
    apartamento?: number;
  }): Promise<ReciboDocument[]> {
    return this.recibosService.findPendientesConSaldo(filters);
  }

  async findById(
    id: string,
    buildingId?: Types.ObjectId,
  ): Promise<ReciboDocument | null> {
    return this.recibosService.findById(id, buildingId);
  }

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
    return this.recibosPagoService.applyPagoAceptado(params);
  }

  async updateEstado(id: string, estado: 'pagado'): Promise<ReciboDocument> {
    return this.recibosPagoService.updateEstado(id, estado);
  }

  async registrarAbono(
    reciboId: string,
    paymentId: string,
    monto: number,
    fecha: Date,
    numeroComprobante?: string,
  ): Promise<ReciboDocument> {
    return this.recibosPagoService.registrarAbono(
      reciboId,
      paymentId,
      monto,
      fecha,
      numeroComprobante,
    );
  }

  async updateManyByMeses(
    input: UpdateManyByMesesInput,
  ): Promise<{ count: number; ids: string[]; abonosRegistrados: number }> {
    return this.recibosPagoService.updateManyByMeses(input);
  }

  async updateManyByIds(
    recibosIds: string[],
    montoPago: number,
    paymentId: string,
    fechaPago: Date,
    numeroComprobante?: string,
    buildingId?: Types.ObjectId,
  ): Promise<{ count: number; ids: string[] }> {
    return this.recibosPagoService.updateManyByIds(
      recibosIds,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
      buildingId,
    );
  }
}
