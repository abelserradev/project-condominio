import { parsearFechaReciboUtc } from './recibos-fecha.util';

describe('parsearFechaReciboUtc', () => {
  it('debe fijar mediodía UTC en formato YYYY-MM-DD', () => {
    const fecha = parsearFechaReciboUtc('2024-03-15');
    expect(fecha.toISOString()).toBe('2024-03-15T12:00:00.000Z');
  });

  it('debe rechazar fechas inválidas', () => {
    expect(() => parsearFechaReciboUtc('xx-yy-zz')).toThrow(/Fecha inválida/);
  });
});
