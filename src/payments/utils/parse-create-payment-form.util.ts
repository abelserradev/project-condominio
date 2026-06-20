import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  sanitizeBanco,
  sanitizeComprobante,
} from '../../common/utils/security.util';
import {
  validateFileMimeType,
  validateFileSize,
} from '../../common/utils/file-validation.util';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export type CreatePaymentFormFields = {
  piso: string;
  apartamento: string;
  meses: string;
  banco: string;
  fechaPago: string;
  numeroComprobante: string;
  montoUsd: string;
  montoBs?: string;
  tasaBcv?: string;
  recibosIds?: string;
};

export type ParsedCreatePaymentForm = {
  piso: number;
  apartamento: number;
  meses: number[];
  banco: string;
  fechaPago: string;
  numeroComprobante: string;
  montoUsd: number;
  montoBs?: number;
  tasaBcv?: number;
  recibosIds?: string[];
  comprobanteBuffer: Buffer;
  comprobanteFilename: string;
  comprobanteMimetype: string;
};

function toFormString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function toOptionalFormString(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  return toFormString(value);
}

export function parseCreatePaymentFormBody(
  raw: unknown,
): CreatePaymentFormFields {
  if (raw == null || typeof raw !== 'object') {
    throw new BadRequestException('Datos del pago inválidos');
  }
  const fields = raw as Record<string, unknown>;
  return {
    piso: toFormString(fields.piso),
    apartamento: toFormString(fields.apartamento),
    meses: toFormString(fields.meses),
    banco: toFormString(fields.banco),
    fechaPago: toFormString(fields.fechaPago),
    numeroComprobante: toFormString(fields.numeroComprobante),
    montoUsd: toFormString(fields.montoUsd),
    montoBs: toOptionalFormString(fields.montoBs),
    tasaBcv: toOptionalFormString(fields.tasaBcv),
    recibosIds: toOptionalFormString(fields.recibosIds),
  };
}

function parseMeses(mesesRaw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(mesesRaw || '[]');
    if (!Array.isArray(parsed)) {
      throw new BadRequestException('meses debe ser un array');
    }
    const meses = parsed.filter(
      (m): m is number => typeof m === 'number' && m >= 1 && m <= 12,
    );
    if (meses.length === 0) {
      throw new BadRequestException('Se requiere al menos un mes válido');
    }
    return meses;
  } catch (e) {
    if (e instanceof BadRequestException) throw e;
    throw new BadRequestException('meses inválido');
  }
}

function parseOptionalRecibosIds(recibosIdsRaw?: string): string[] | undefined {
  if (!recibosIdsRaw) return undefined;
  try {
    const parsed: unknown = JSON.parse(recibosIdsRaw);
    if (!Array.isArray(parsed) || parsed.length === 0) return undefined;
    const recibosIds = parsed.filter(
      (id): id is string =>
        typeof id === 'string' && Types.ObjectId.isValid(id),
    );
    return recibosIds.length > 0 ? recibosIds : undefined;
  } catch {
    return undefined;
  }
}

function parseOptionalFloat(
  value: string | undefined,
  errorMessage: string,
): number | undefined {
  if (value == null || value === '') return undefined;
  const n = Number.parseFloat(value);
  if (Number.isNaN(n) || n < 0) {
    throw new BadRequestException(errorMessage);
  }
  return n;
}

export function buildCreatePaymentFromForm(
  file: Express.Multer.File | undefined,
  rawBody: unknown,
): ParsedCreatePaymentForm {
  if (!file?.buffer) {
    throw new BadRequestException('Se requiere el comprobante');
  }
  validateFileSize(file.buffer, MAX_SIZE_BYTES);
  const validatedMimeType = validateFileMimeType(file.buffer, file.mimetype);
  const form = parseCreatePaymentFormBody(rawBody);
  const piso = Number.parseInt(form.piso, 10);
  const apartamento = Number.parseInt(form.apartamento, 10);
  if (Number.isNaN(piso) || Number.isNaN(apartamento)) {
    throw new BadRequestException('piso y apartamento inválidos');
  }
  const meses = parseMeses(form.meses);
  const montoUsd = Number.parseFloat(form.montoUsd);
  if (Number.isNaN(montoUsd) || montoUsd <= 0) {
    throw new BadRequestException('montoUsd inválido');
  }
  if (!form.fechaPago.trim()) {
    throw new BadRequestException('fechaPago requerido');
  }
  return {
    piso,
    apartamento,
    meses,
    banco: sanitizeBanco(form.banco),
    fechaPago: form.fechaPago.trim(),
    numeroComprobante: sanitizeComprobante(form.numeroComprobante),
    montoUsd,
    montoBs: parseOptionalFloat(form.montoBs, 'montoBs inválido'),
    tasaBcv: parseOptionalFloat(form.tasaBcv, 'tasaBcv inválida'),
    recibosIds: parseOptionalRecibosIds(form.recibosIds),
    comprobanteBuffer: file.buffer,
    comprobanteFilename: file.originalname,
    comprobanteMimetype: validatedMimeType,
  };
}
