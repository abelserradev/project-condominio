import { Types } from 'mongoose';
import { prepararBulkAbonosRecibos } from './recibos-abono-bulk.util';
import { ReciboDocument } from '../schemas/recibo.schema';

describe('prepararBulkAbonosRecibos', () => {
  it('reparte monto entre dos recibos en orden', () => {
    const id1 = new Types.ObjectId();
    const id2 = new Types.ObjectId();
    const recibos = [
      {
        _id: id1,
        montoUsd: 60,
        montoPagado: 0,
        abonos: [],
      },
      {
        _id: id2,
        montoUsd: 60,
        montoPagado: 0,
        abonos: [],
      },
    ] as ReciboDocument[];

    const { bulkOps, ids, recibosCompletos } = prepararBulkAbonosRecibos(
      recibos,
      80,
      new Types.ObjectId().toString(),
      new Date('2024-01-15T12:00:00.000Z'),
    );

    expect(bulkOps).toHaveLength(2);
    expect(ids).toEqual([id1.toString(), id2.toString()]);
    expect(recibosCompletos.size).toBe(1);
    expect(bulkOps[0].updateOne.update.$set.montoPagado).toBe(60);
    expect(bulkOps[1].updateOne.update.$set.montoPagado).toBe(20);
  });
});
