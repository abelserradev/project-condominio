import type { ExtractionResult } from '../interfaces/extraction-result.interface';
import type { ComprobanteExtractionDto } from '../dto/comprobante-extraction.dto';
import { sanitizeComprobanteExtraction } from '../dto/comprobante-extraction.dto';

const MONTO_PATTERNS: RegExp[] = [
  /[Mm]onto\s*\([Bb]s\.?\)\s*:?\s*([\d.,]+)/,
  /bs\.?\s*([\d.,]+)/i,
  /(?:monto operación|monto)\s*\(?bs\.?\)?\s*:?\s*([\d.,]+)/i,
  /(?:bs|bol[ií]vares?)\s*:?\s*([\d.,]+)/i,
  /([\d.,]+)\s*bs/i,
];

const FECHA_PATTERNS: RegExp[] = [
  /(?:fecha operación|fecha)\s*:?\s*(\d{2})-(\d{2})-(\d{4})/i,
  /(\d{4})-(\d{2})-(\d{2})/,
  /(\d{2})\/(\d{2})\/(\d{4})/,
  /(\d{2})\/(\d{2})\/(\d{2})/,
  /(\d{2})-(\d{2})-(\d{4})/,
];

const REFERENCIA_PATTERNS: RegExp[] = [
  /nro\.?\s*de\s*referencia\s*:?\s*(\d{5,})/i,
  /(?:número de operación|numero de operacion)\s+es\s+(\d+)/i,
  /(?:operación|operacion|referencia)\s*:?\s*(\d{5,})/i,
  /(\d{10,})/,
];

const BANCO_ENVIO_PATTERN =
  /(?:banco\s+de\s+env[ií]o|banco\s+origen)\s*:?\s*([^\n]+)/i;

export function parseComprobanteResponse(
  result: ExtractionResult,
): ComprobanteExtractionDto {
  const dto: Record<string, unknown> = {};

  if (result.structured && typeof result.structured === 'object') {
    applyStructuredExtraction(result.structured, dto);
  }

  if (Object.keys(dto).length === 0 || needsFallback(dto)) {
    applyRegexFallback(result.raw, dto);
  }

  return sanitizeComprobanteExtraction(dto);
}

function applyStructuredExtraction(
  structured: Record<string, unknown>,
  dto: Record<string, unknown>,
): void {
  dto.banco = safeString(
    structured.banco ?? structured.bankName ?? structured.banco_emisor,
  );
  dto.fechaPago = safeString(
    structured.fechaPago ?? structured.fecha ?? structured.date,
  );
  dto.numeroComprobante = safeString(
    structured.numeroComprobante ??
      structured.referencia ??
      structured.reference,
  );
  dto.montoBs = safeNumber(
    structured.montoBs ?? structured.monto_bs ?? structured.amountBs,
  );
  dto.montoUsd = safeNumber(
    structured.montoUsd ?? structured.monto_usd ?? structured.amountUsd,
  );
}

function safeString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const s = v.trim();
    return s === '' || s.toLowerCase() === 'null' ? undefined : s;
  }
  if (typeof v === 'number' || typeof v === 'boolean') {
    const s = String(v).trim();
    return s === '' ? undefined : s;
  }
  return undefined;
}

function normalizeAmountDigits(raw: string): string {
  const compact = raw.trim().replace(/\s/g, '');
  const veFormat = /,\d{2}$/.test(compact);
  if (veFormat) {
    return compact.replaceAll('.', '').replace(',', '.');
  }
  return compact.replaceAll(',', '');
}

function parsePositiveAmount(raw: string): number | undefined {
  const n = Number.parseFloat(normalizeAmountDigits(raw));
  if (Number.isNaN(n) || n <= 0) return undefined;
  return n;
}

function safeNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (
    typeof v !== 'string' &&
    typeof v !== 'number' &&
    typeof v !== 'boolean'
  ) {
    return undefined;
  }
  const n = Number.parseFloat(normalizeAmountDigits(String(v)));
  return Number.isNaN(n) ? undefined : n;
}

function needsFallback(dto: Record<string, unknown>): boolean {
  return !dto.montoBs && !dto.banco && !dto.numeroComprobante;
}

function firstMatch(raw: string, patterns: RegExp[]): RegExpMatchArray | null {
  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (match) return match;
  }
  return null;
}

function formatFechaMatch(fechaMatch: RegExpMatchArray): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaMatch[0])) {
    return fechaMatch[0];
  }
  if (fechaMatch[3]?.length === 2) {
    const yy = Number.parseInt(fechaMatch[3], 10);
    const fullYear = yy >= 0 && yy <= 50 ? 2000 + yy : 1900 + yy;
    return `${fullYear}-${fechaMatch[2]}-${fechaMatch[1]}`;
  }
  return `${fechaMatch[3]}-${fechaMatch[2]}-${fechaMatch[1]}`;
}

function extractMontoBs(raw: string): number | undefined {
  const montoMatch = firstMatch(raw, MONTO_PATTERNS);
  if (!montoMatch?.[1]) return undefined;
  return parsePositiveAmount(montoMatch[1]);
}

function extractFechaPago(raw: string): string | undefined {
  const fechaMatch = firstMatch(raw, FECHA_PATTERNS);
  if (!fechaMatch) return undefined;
  return formatFechaMatch(fechaMatch);
}

function extractNumeroComprobante(raw: string): string | undefined {
  const refMatch = firstMatch(raw, REFERENCIA_PATTERNS);
  return refMatch?.[1];
}

function inferBancoDesdeDestino(raw: string): string | undefined {
  if (/mercantil/i.test(raw)) return 'Banco Mercantil';
  if (/bancamiga/i.test(raw)) return 'Bancamiga';
  if (/provincial/i.test(raw)) return 'Banco Provincial';
  if (/bod|occidental\s*descuento/i.test(raw)) {
    return 'Banco Occidental de Descuento (BOD)';
  }
  return undefined;
}

function inferBancoDesdeGeneral(raw: string): string | undefined {
  if (/banco\s+de\s+venezuela|bdv|pagomóvil/i.test(raw)) {
    return 'Banco de Venezuela';
  }
  if (/mercantil/i.test(raw)) return 'Banco Mercantil';
  if (/bancamiga/i.test(raw)) return 'Bancamiga';
  if (/provincial/i.test(raw)) return 'Banco Provincial';
  return undefined;
}

function extractBanco(raw: string): string | undefined {
  const bancoEnvioMatch = BANCO_ENVIO_PATTERN.exec(raw);
  if (bancoEnvioMatch?.[1]) {
    const nombre = bancoEnvioMatch[1].trim();
    if (nombre) return resolveNombreBanco(nombre);
  }

  if (/banco\s+destino/i.test(raw)) {
    return inferBancoDesdeDestino(raw);
  }
  return inferBancoDesdeGeneral(raw);
}

function applyRegexFallback(raw: string, dto: Record<string, unknown>): void {
  if (!dto.montoBs) {
    dto.montoBs = extractMontoBs(raw);
  }
  if (!dto.fechaPago) {
    dto.fechaPago = extractFechaPago(raw);
  }
  if (!dto.numeroComprobante) {
    dto.numeroComprobante = extractNumeroComprobante(raw);
  }
  if (!dto.banco) {
    dto.banco = extractBanco(raw);
  }
}

function resolveNombreBanco(texto: string): string {
  const t = texto.toLowerCase();
  if (/mercantil/i.test(t)) return 'Banco Mercantil';
  if (/venezuela|bdv/i.test(t)) return 'Banco de Venezuela';
  if (/bancamiga/i.test(t)) return 'Bancamiga';
  if (/bnc|nacional\s*cr[eé]dito/i.test(t)) return 'BNC Banco Universal';
  if (/provincial/i.test(t)) return 'Banco Provincial';
  if (/bod|occidental/i.test(t)) return 'Banco Occidental de Descuento (BOD)';
  return texto.trim();
}
