import { ReciboDocument } from '../schemas/recibo.schema';

export function reciboTieneSaldoPendiente(recibo: ReciboDocument): boolean {
  const montoPagado = recibo.montoPagado || 0;
  return montoPagado < recibo.montoUsd;
}

export function filtrarRecibosConSaldo(
  recibos: ReciboDocument[],
): ReciboDocument[] {
  return recibos.filter(reciboTieneSaldoPendiente);
}

export function sumarDeudaPendienteRecibos(recibos: ReciboDocument[]): number {
  return recibos.reduce((sum, r) => {
    const montoPagado = r.montoPagado || 0;
    return sum + (r.montoUsd - montoPagado);
  }, 0);
}
