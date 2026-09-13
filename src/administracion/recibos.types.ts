import { Types } from 'mongoose';

export type CreateReciboInput = {
  buildingId?: Types.ObjectId;
  piso: number;
  apartamento: number;
  meses: number[];
  montoUsd: number;
  tipoDeuda: string;
  fechaReportada: string;
  facturaBuffer?: Buffer;
  facturaFilename?: string;
  facturaMimetype?: string;
  facturaFileId?: string;
};

export type UpdateManyByMesesInput = {
  buildingId?: Types.ObjectId;
  piso: number;
  apartamento: number;
  meses: number[];
  montoPago: number;
  paymentId: string;
  fechaPago: Date;
  numeroComprobante?: string;
};
