import type { ExtractionResult } from '../interfaces/extraction-result.interface';
import type { ComprobanteExtractionDto } from '../dto/comprobante-extraction.dto';
import { sanitizeComprobanteExtraction } from '../dto/comprobante-extraction.dto';

export function parseComprobanteResponse(
  result: ExtractionResult,
): ComprobanteExtractionDto {
  const dto: Record<string, unknown> = {};

  if (result.structured && typeof result.structured === 'object') {
    dto.banco = safeString(
      result.structured.banco ??
        result.structured.bankName ??
        result.structured.banco_emisor,
    );
    dto.fechaPago = safeString(
      result.structured.fechaPago ??
        result.structured.fecha ??
        result.structured.date,
    );
    dto.numeroComprobante = safeString(
      result.structured.numeroComprobante ??
        result.structured.referencia ??
        result.structured.reference,
    );
    dto.montoBs = safeNumber(
      result.structured.montoBs ??
        result.structured.monto_bs ??
        result.structured.amountBs,
    );
    dto.montoUsd = safeNumber(
      result.structured.montoUsd ??
        result.structured.monto_usd ??
        result.structured.amountUsd,
    );
  }

  if (Object.keys(dto).length === 0 || needsFallback(dto)) {
    applyRegexFallback(result.raw, dto);
  }

  return sanitizeComprobanteExtraction(dto);
}

function safeString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === '' || s.toLowerCase() === 'null' ? undefined : s;
}

function safeNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  const s = String(v).trim().replace(/\s/g, '');
  const veFormat = /,\d{2}$/.test(s);
  const normalized = veFormat
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? undefined : n;
}

function needsFallback(dto: Record<string, unknown>): boolean {
  return !dto.montoBs && !dto.banco && !dto.numeroComprobante;
}

function applyRegexFallback(
  raw: string,
  dto: Record<string, unknown>,
): void {
  if (!dto.montoBs) {
    const montoMatch =
      raw.match(/(?:monto operación|monto)\s*\(?bs\.?\)?\s*:?\s*([\d.,]+)/i) ??
      raw.match(/(?:bs|bol[ií]vares?)\s*:?\s*([\d.,]+)/i) ??
      raw.match(/([\d.,]+)\s*bs/i);
    if (montoMatch) {
      const normalized = montoMatch[1].replace(/\./g, '').replace(',', '.');
      const n = parseFloat(normalized);
      if (!Number.isNaN(n) && n > 0) dto.montoBs = n;
    }
  }
  if (!dto.fechaPago) {
    const fechaMatch =
      raw.match(/(?:fecha operación|fecha)\s*:?\s*(\d{2})-(\d{2})-(\d{4})/i) ??
      raw.match(/(\d{4})-(\d{2})-(\d{2})/) ??
      raw.match(/(\d{2})\/(\d{2})\/(\d{4})/) ??
      raw.match(/(\d{2})-(\d{2})-(\d{4})/);
    if (fechaMatch) {
      if (fechaMatch[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
        dto.fechaPago = fechaMatch[0];
      } else {
        dto.fechaPago = `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
      }
    }
  }
  if (!dto.numeroComprobante) {
    const refMatch =
      raw.match(/(?:número de operación|numero de operacion)\s+es\s+(\d+)/i) ??
      raw.match(/(?:operación|operacion|referencia)\s*:?\s*(\d{8,})/i) ??
      raw.match(/(\d{10,})/);
    if (refMatch) dto.numeroComprobante = refMatch[1];
  }
  if (!dto.banco) {
    if (/banco\s+de\s+venezuela|bdv|pagomóvil/i.test(raw)) {
      dto.banco = 'Banco de Venezuela';
    } else if (/mercantil/i.test(raw)) dto.banco = 'Banco Mercantil';
    else if (/provincial/i.test(raw)) dto.banco = 'Banco Provincial';
  }
}
