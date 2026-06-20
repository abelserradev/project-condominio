/**
 * Utilidades para serializar documentos Mongoose a respuestas JSON.
 * Convierte ObjectId y arrays de ObjectId a string para evitar exponer objetos internos.
 */

function toObjectIdString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const obj = value as { toString: () => string };
    return obj.toString();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

/**
 * Mapea un documento de pago al formato de respuesta API (ObjectId → string).
 */
export function mapPaymentToResponse(
  payment: Record<string, unknown>,
): Record<string, unknown> {
  const fid = toObjectIdString(payment.comprobanteFileId);
  const recibosPagadosRaw = payment.recibosPagados as unknown[] | undefined;
  const recibosPagados = Array.isArray(recibosPagadosRaw)
    ? recibosPagadosRaw.map((id) => toObjectIdString(id) ?? String(id))
    : [];
  return {
    ...payment,
    comprobanteFileId: fid ?? null,
    recibosPagados,
  };
}

/**
 * Mapea un documento de recibo al formato de respuesta API (facturaFileId → string).
 */
export function mapReciboToResponse(
  recibo: Record<string, unknown>,
): Record<string, unknown> {
  const fid = toObjectIdString(recibo.facturaFileId);
  return {
    ...recibo,
    facturaFileId: fid ?? null,
  };
}
