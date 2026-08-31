/**
 * Clasificación de cobranza por apartamento — fuente de verdad del reporte.
 *
 * Reglas acordadas (specs/prd/reporte-cobranza.md):
 * - al_dia: saldo neto 0 (incluye apartamentos sin recibo emitido).
 * - moroso: cualquier saldo neto > 0, sin importar el tipoDeuda.
 * - en revisión: pagos con estado 'pendiente' se exponen como columnas,
 *   nunca cambian la categoría principal (un moroso con pago reportado
 *   sigue siendo moroso hasta que el admin lo acepte).
 *
 * Funciones puras: el reporte Excel y el resumen admin consumen lo mismo.
 */

export type CategoriaCobranza = 'al_dia' | 'moroso';

export interface ReciboCobranzaInput {
  piso: number;
  apartamento: number;
  meses: number[];
  montoUsd: number;
  montoPagado?: number;
  tipoDeuda: string;
}

export interface PagoPendienteInput {
  piso: number;
  apartamento: number;
  montoUsd: number;
}

export interface FilaCobranza {
  piso: number;
  apartamento: number;
  categoria: CategoriaCobranza;
  saldoBrutoUsd: number;
  abonoUsd: number;
  saldoNetoUsd: number;
  mesesPendientes: number[];
  tiposDeuda: string[];
  tienePagoEnRevision: boolean;
  cantidadPagosEnRevision: number;
  montoEnRevisionUsd: number;
}

// Los montos del dominio son number (deuda técnica conocida); redondeamos a 2
// decimales para que los floats no conviertan un saldo cero en 1e-14.
// TODO: migrar a Decimal cuando se aborde la precisión monetaria del dominio.
function redondear2(monto: number): number {
  return Math.round(monto * 100) / 100;
}

export function saldoRecibo(recibo: ReciboCobranzaInput): number {
  const pagado = recibo.montoPagado ?? 0;
  return Math.max(0, recibo.montoUsd - pagado);
}

export function calcularSaldoBruto(recibos: ReciboCobranzaInput[]): number {
  const bruto = recibos.reduce((suma, r) => suma + saldoRecibo(r), 0);
  return redondear2(bruto);
}

export function calcularSaldoNeto(saldoBruto: number, abono: number): number {
  return redondear2(Math.max(0, saldoBruto - abono));
}

export function clasificarApartamento(saldoNeto: number): CategoriaCobranza {
  return saldoNeto > 0 ? 'moroso' : 'al_dia';
}

export function construirFilaCobranza(params: {
  piso: number;
  apartamento: number;
  recibos: ReciboCobranzaInput[];
  abonoUsd: number;
  pagosPendientes: PagoPendienteInput[];
}): FilaCobranza {
  const { piso, apartamento, recibos, abonoUsd, pagosPendientes } = params;
  const recibosConSaldo = recibos.filter((r) => saldoRecibo(r) > 0);

  const saldoBrutoUsd = calcularSaldoBruto(recibos);
  const saldoNetoUsd = calcularSaldoNeto(saldoBrutoUsd, abonoUsd);

  const mesesPendientes = [
    ...new Set(recibosConSaldo.flatMap((r) => r.meses)),
  ].sort((a, b) => a - b);
  const tiposDeuda = [...new Set(recibosConSaldo.map((r) => r.tipoDeuda))];

  const montoEnRevision = pagosPendientes.reduce(
    (suma, p) => suma + p.montoUsd,
    0,
  );

  return {
    piso,
    apartamento,
    categoria: clasificarApartamento(saldoNetoUsd),
    saldoBrutoUsd,
    abonoUsd: redondear2(abonoUsd),
    saldoNetoUsd,
    mesesPendientes,
    tiposDeuda,
    tienePagoEnRevision: pagosPendientes.length > 0,
    cantidadPagosEnRevision: pagosPendientes.length,
    montoEnRevisionUsd: redondear2(montoEnRevision),
  };
}
