import { z } from 'zod';

export const ComprobanteExtractionSchema = z.object({
  banco: z.string().trim().optional(),
  fechaPago: z.string().optional(),
  numeroComprobante: z.string().trim().optional(),
  montoBs: z.number().positive().optional().nullable(),
  montoUsd: z.number().positive().optional().nullable(),
});

export type ComprobanteExtractionDto = z.infer<typeof ComprobanteExtractionSchema>;

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
  if (typeof raw.numeroComprobante === 'string' && raw.numeroComprobante.trim()) {
    partial.numeroComprobante = raw.numeroComprobante.trim();
  }

  const montoBs = typeof raw.montoBs === 'number' ? raw.montoBs : parseFloat(String(raw.montoBs ?? ''));
  if (!Number.isNaN(montoBs) && montoBs > 0) {
    partial.montoBs = montoBs;
  }

  const montoUsd =
    typeof raw.montoUsd === 'number' ? raw.montoUsd : parseFloat(String(raw.montoUsd ?? ''));
  if (!Number.isNaN(montoUsd) && montoUsd > 0) {
    partial.montoUsd = montoUsd;
  }

  const fecha = safeNormalizeDate(raw.fechaPago);
  if (fecha) {
    partial.fechaPago = fecha;
  }

  const parsed = ComprobanteExtractionSchema.safeParse(partial);
  return parsed.success ? parsed.data : partial;
}

function safeNormalizeDate(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === '' || s.toLowerCase() === 'null') return undefined;
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  const ddmmyyyy = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
  return s;
}
