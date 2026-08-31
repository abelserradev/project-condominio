import {
  calcularSaldoBruto,
  calcularSaldoNeto,
  clasificarApartamento,
  construirFilaCobranza,
  saldoRecibo,
  type ReciboCobranzaInput,
} from './cobranza-classification.util';

const reciboCon = (
  overrides: Partial<ReciboCobranzaInput>,
): ReciboCobranzaInput => ({
  piso: 1,
  apartamento: 1,
  meses: [8],
  montoUsd: 100,
  tipoDeuda: 'condominio',
  ...overrides,
});

describe('saldoRecibo', () => {
  it('usa 0 cuando montoPagado no viene en el documento', () => {
    expect(saldoRecibo(reciboCon({}))).toBe(100);
  });

  it('nunca devuelve negativo aunque el pago supere el monto', () => {
    expect(saldoRecibo(reciboCon({ montoPagado: 150 }))).toBe(0);
  });
});

describe('calcularSaldoNeto', () => {
  it('el abono a favor descuenta la deuda (UX pública de recibos)', () => {
    expect(calcularSaldoNeto(100, 40)).toBe(60);
  });

  it('un abono mayor a la deuda deja saldo cero, no negativo', () => {
    expect(calcularSaldoNeto(50, 80)).toBe(0);
  });
});

describe('clasificarApartamento', () => {
  it('REQ-002: saldo neto cero es al_dia', () => {
    expect(clasificarApartamento(0)).toBe('al_dia');
  });

  it('REQ-004: cualquier saldo positivo es moroso', () => {
    expect(clasificarApartamento(0.01)).toBe('moroso');
  });
});

describe('construirFilaCobranza', () => {
  it('REQ-003: apartamento sin recibos emitidos queda al_dia', () => {
    const fila = construirFilaCobranza({
      piso: 2,
      apartamento: 5,
      recibos: [],
      abonoUsd: 0,
      pagosPendientes: [],
    });
    expect(fila.categoria).toBe('al_dia');
    expect(fila.saldoNetoUsd).toBe(0);
  });

  it('REQ-002: recibo pagado completo queda al_dia', () => {
    const fila = construirFilaCobranza({
      piso: 1,
      apartamento: 1,
      recibos: [reciboCon({ montoPagado: 100 })],
      abonoUsd: 0,
      pagosPendientes: [],
    });
    expect(fila.categoria).toBe('al_dia');
  });

  it('REQ-004: deuda de cualquier tipoDeuda (no solo condominio) es moroso', () => {
    const fila = construirFilaCobranza({
      piso: 1,
      apartamento: 1,
      recibos: [reciboCon({ tipoDeuda: 'fondo_de_reserva' })],
      abonoUsd: 0,
      pagosPendientes: [],
    });
    expect(fila.categoria).toBe('moroso');
    expect(fila.tiposDeuda).toEqual(['fondo_de_reserva']);
  });

  it('abono que cubre toda la deuda deja al apartamento al_dia', () => {
    const fila = construirFilaCobranza({
      piso: 1,
      apartamento: 1,
      recibos: [reciboCon({ montoUsd: 80 })],
      abonoUsd: 80,
      pagosPendientes: [],
    });
    expect(fila.categoria).toBe('al_dia');
    expect(fila.saldoBrutoUsd).toBe(80);
    expect(fila.saldoNetoUsd).toBe(0);
  });

  it('REQ-005: moroso con pago pendiente sigue moroso y expone la revisión', () => {
    const fila = construirFilaCobranza({
      piso: 3,
      apartamento: 2,
      recibos: [reciboCon({ montoUsd: 100, montoPagado: 30 })],
      abonoUsd: 0,
      pagosPendientes: [{ piso: 3, apartamento: 2, montoUsd: 70 }],
    });
    expect(fila.categoria).toBe('moroso');
    expect(fila.tienePagoEnRevision).toBe(true);
    expect(fila.cantidadPagosEnRevision).toBe(1);
    expect(fila.montoEnRevisionUsd).toBe(70);
  });

  it('REQ-005: solo pago pendiente sin deuda queda al_dia con flag de revisión', () => {
    const fila = construirFilaCobranza({
      piso: 4,
      apartamento: 1,
      recibos: [],
      abonoUsd: 0,
      pagosPendientes: [
        { piso: 4, apartamento: 1, montoUsd: 50 },
        { piso: 4, apartamento: 1, montoUsd: 25 },
      ],
    });
    expect(fila.categoria).toBe('al_dia');
    expect(fila.tienePagoEnRevision).toBe(true);
    expect(fila.cantidadPagosEnRevision).toBe(2);
    expect(fila.montoEnRevisionUsd).toBe(75);
  });

  it('meses pendientes salen únicos y ordenados de los recibos con saldo', () => {
    const fila = construirFilaCobranza({
      piso: 1,
      apartamento: 1,
      recibos: [
        reciboCon({ meses: [8, 9] }),
        reciboCon({ meses: [7, 8], montoUsd: 50 }),
        reciboCon({ meses: [6], montoPagado: 100 }),
      ],
      abonoUsd: 0,
      pagosPendientes: [],
    });
    expect(fila.mesesPendientes).toEqual([7, 8, 9]);
  });
});

describe('calcularSaldoBruto', () => {
  it('suma solo la parte no pagada de cada recibo', () => {
    const bruto = calcularSaldoBruto([
      reciboCon({ montoUsd: 100, montoPagado: 25 }),
      reciboCon({ montoUsd: 50 }),
    ]);
    expect(bruto).toBe(125);
  });
});
