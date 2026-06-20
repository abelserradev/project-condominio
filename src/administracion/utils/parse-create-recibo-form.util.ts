export interface CreateReciboFormFields {
  piso: string;
  apartamento: string;
  meses: string;
  montoUsd: string;
  tipoDeuda: string;
  fechaReportada: string;
}

function toFormString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function parseCreateReciboFormBody(
  raw: unknown,
): CreateReciboFormFields {
  if (raw == null || typeof raw !== 'object') {
    throw new Error('CREATE_RECIBO_BODY_INVALID');
  }
  const fields = raw as Record<string, unknown>;
  return {
    piso: toFormString(fields.piso),
    apartamento: toFormString(fields.apartamento),
    meses: toFormString(fields.meses),
    montoUsd: toFormString(fields.montoUsd),
    tipoDeuda: toFormString(fields.tipoDeuda),
    fechaReportada: toFormString(fields.fechaReportada),
  };
}
