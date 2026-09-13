import { ReciboDocument } from '../schemas/recibo.schema';
import {
  prepararBulkAbonosRecibos,
  ReciboBulkUpdateOp,
} from './recibos-abono-bulk.util';
import { filtrarRecibosConSaldo } from './recibos-pendientes.util';

export type PreparacionBulkRecibos =
  | { vacio: true; bulkOps: []; count: 0; ids: []; abonosRegistrados: 0 }
  | {
      vacio: false;
      bulkOps: ReciboBulkUpdateOp[];
      count: number;
      ids: string[];
      abonosRegistrados: number;
    };

export function prepararPersistenciaBulkRecibos(
  recibos: ReciboDocument[],
  montoPago: number,
  paymentId: string,
  fechaPago: Date,
  numeroComprobante?: string,
): PreparacionBulkRecibos {
  const recibosPendientes = filtrarRecibosConSaldo(recibos);
  if (recibosPendientes.length === 0) {
    return {
      vacio: true,
      bulkOps: [],
      count: 0,
      ids: [],
      abonosRegistrados: 0,
    };
  }
  const { bulkOps, ids, abonosRegistrados, recibosCompletos } =
    prepararBulkAbonosRecibos(
      recibosPendientes,
      montoPago,
      paymentId,
      fechaPago,
      numeroComprobante,
    );
  return {
    vacio: false,
    bulkOps,
    count: recibosCompletos.size,
    ids,
    abonosRegistrados,
  };
}
