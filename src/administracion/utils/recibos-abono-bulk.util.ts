import { Types } from 'mongoose';
import { Abono, ReciboDocument } from '../schemas/recibo.schema';

export type ReciboBulkUpdateOp = {
  updateOne: {
    filter: { _id: Types.ObjectId };
    update: {
      $set: {
        montoPagado: number;
        abonos: Abono[];
        estado: string;
      };
    };
  };
};

/** Reparte un monto de pago entre recibos pendientes preparando bulkWrite (sin I/O). */
export function prepararBulkAbonosRecibos(
  recibos: ReciboDocument[],
  montoPago: number,
  paymentId: string,
  fechaPago: Date,
  numeroComprobante?: string,
): {
  bulkOps: ReciboBulkUpdateOp[];
  ids: string[];
  abonosRegistrados: number;
  recibosCompletos: Set<string>;
} {
  const bulkOps: ReciboBulkUpdateOp[] = [];
  const ids: string[] = [];
  let abonosRegistrados = 0;
  const recibosCompletos = new Set<string>();
  let montoRestante = montoPago;
  for (const recibo of recibos) {
    if (montoRestante <= 0) break;
    const reciboId = recibo._id.toString();
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
    bulkOps.push({
      updateOne: {
        filter: { _id: recibo._id },
        update: {
          $set: {
            montoPagado: nuevoMontoPagado,
            abonos: abonosActualizados,
            estado:
              nuevoMontoPagado >= recibo.montoUsd ? 'pagado' : 'pendiente',
          },
        },
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
