import { calcularAplicacionPagoConAbono } from './recibos-pago-calculo.util';

describe('calcularAplicacionPagoConAbono', () => {
  it('aplica pago parcial y deja excedente', () => {
    const r = calcularAplicacionPagoConAbono(150, 100, 0);
    expect(r.amountFromPayment).toBe(100);
    expect(r.excess).toBe(50);
    expect(r.totalToApply).toBe(100);
  });

  it('consume abono de apto cuando el pago no cubre la deuda', () => {
    const r = calcularAplicacionPagoConAbono(40, 100, 30);
    expect(r.amountFromPayment).toBe(40);
    expect(r.amountFromAbono).toBe(30);
    expect(r.totalToApply).toBe(70);
    expect(r.excess).toBe(0);
  });
});
