import { Types } from 'mongoose';
import {
  filtrarRecibosConSaldo,
  sumarDeudaPendienteRecibos,
} from './recibos-pendientes.util';
import { ReciboDocument } from '../schemas/recibo.schema';

function reciboStub(partial: Partial<ReciboDocument>): ReciboDocument {
  return {
    _id: new Types.ObjectId(),
    montoUsd: 100,
    montoPagado: 0,
    ...partial,
  } as ReciboDocument;
}

describe('recibos-pendientes.util', () => {
  it('filtra recibos con saldo', () => {
    const list = [
      reciboStub({ montoPagado: 100 }),
      reciboStub({ montoPagado: 20 }),
    ];
    expect(filtrarRecibosConSaldo(list)).toHaveLength(1);
  });

  it('suma deuda pendiente', () => {
    const list = [
      reciboStub({ montoUsd: 100, montoPagado: 25 }),
      reciboStub({ montoUsd: 50, montoPagado: 0 }),
    ];
    expect(sumarDeudaPendienteRecibos(list)).toBe(125);
  });
});
