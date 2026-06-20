export class PaymentEntity {
  buildingId?: string;
  piso: number;
  apartamento: number;
  idUnico: string;
  meses: number[];
  banco: string;
  fechaPago: Date;
  numeroComprobante: string;
  montoUsd: number;
  montoBs?: number;
  tasaBcv?: number;
  comprobanteFileId?: string;
  recibosPagados?: string[];
  estado: string;
}
