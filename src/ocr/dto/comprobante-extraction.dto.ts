import { z } from 'zod';

export const ComprobanteExtractionSchema = z.object({
  banco: z.string().trim().optional(),
  fechaPago: z.string().optional(),
  numeroComprobante: z.string().trim().optional(),
  montoBs: z.number().positive().optional().nullable(),
  montoUsd: z.number().positive().optional().nullable(),
});

export type ComprobanteExtractionDto = z.infer<
  typeof ComprobanteExtractionSchema
>;

/**
 * Sanitiza y valida datos crudos del OCR al DTO de negocio.
 * Rechaza montos negativos, normaliza fechas.
 */
export function sanitizeComprobanteExtraction(
  raw: Record<string, unknown>,
): ComprobanteExtractionDto {
  const partial: ComprobanteExtractionDto = {};

  if (typeof raw.banco === 'string' && raw.banco.trim()) {
    partial.banco = raw.banco.trim();
  }
  if (
    typeof raw.numeroComprobante === 'string' &&
    raw.numeroComprobante.trim()
  ) {
    partial.numeroComprobante = raw.numeroComprobante.trim();
  }

  const montoBs = parsePositiveNumber(raw.montoBs);
  if (montoBs !== undefined) {
    partial.montoBs = montoBs;
  }

  const montoUsd = parsePositiveNumber(raw.montoUsd);
  if (montoUsd !== undefined) {
    partial.montoUsd = montoUsd;
  }

  const fecha = safeNormalizeDate(raw.fechaPago);
  if (fecha) {
    partial.fechaPago = fecha;
  }

  const parsed = ComprobanteExtractionSchema.safeParse(partial);
  return parsed.success ? parsed.data : partial;
}

function parsePositiveNumber(v: unknown): number | undefined {
  if (typeof v === 'number') {
    if (Number.isNaN(v) || v <= 0) return undefined;
    return v;
  }
  if (typeof v !== 'string') return undefined;
  const n = Number.parseFloat(v);
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n;
}

const FECHA_ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const FECHA_DDMMYYYY_PATTERN = /(\d{2})\/(\d{2})\/(\d{4})/;

function safeNormalizeDate(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (
    typeof v !== 'string' &&
    typeof v !== 'number' &&
    typeof v !== 'boolean'
  ) {
    return undefined;
  }
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return undefined;
  const isoMatch = FECHA_ISO_PATTERN.exec(s);
  if (isoMatch) return isoMatch[0];
  const ddmmyyyy = FECHA_DDMMYYYY_PATTERN.exec(s);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return s;
}
