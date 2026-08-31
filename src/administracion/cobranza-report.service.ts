import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Recibo, ReciboDocument } from './schemas/recibo.schema';
import {
  AbonoApartamento,
  AbonoApartamentoDocument,
} from './schemas/abono-apartamento.schema';
import {
  Apartment,
  apartmentdocument,
} from '../apartments/schemas/apartment.schema';
import { Payment, paymentdocument } from '../payments/schemas/payment.schema';
import { Owner, OwnerDocument } from '../owners/schemas/owner.schema';
import {
  construirFilaCobranza,
  type FilaCobranza,
  type PagoPendienteInput,
  type ReciboCobranzaInput,
} from './utils/cobranza-classification.util';
import { buildCobranzaWorkbook } from './utils/cobranza-excel.util';

export type FiltroCobranza = 'todos' | 'al_dia' | 'moroso';

export interface FilaCobranzaDetalle extends FilaCobranza {
  idUnico: string;
  propietario: string | null;
  emailPropietario: string | null;
}

export interface ReporteCobranza {
  generadoEn: string;
  resumen: {
    totalApartamentos: number;
    alDia: number;
    morosos: number;
    enRevision: number;
  };
  filas: FilaCobranzaDetalle[];
}

const claveApto = (piso: number, apartamento: number): string =>
  `${piso}-${apartamento}`;

/**
 * Arma el reporte de cobranza del edificio: una fila por apartamento.
 * Es la única fuente de la clasificación al_dia/moroso — el resumen admin
 * y el Excel salen del mismo DTO para que nunca diverjan (ver PRD §4).
 */
@Injectable()
export class CobranzaReportService {
  constructor(
    // Consulta directa a Recibo (no AdministracionService.findAll): el reporte
    // solo necesita recibos con saldo; traer historial pagado infla memoria
    // y latencia en edificios con años de datos (delta read-model).
    @InjectModel(Recibo.name)
    private readonly reciboModel: Model<ReciboDocument>,
    @InjectModel(Apartment.name)
    private readonly apartmentModel: Model<apartmentdocument>,
    // Se inyectan los modelos directo y no PaymentsService/OwnersService:
    // PaymentsModule ya importa AdministracionModule (forwardRef) y meter el
    // servicio acá cerraría el ciclo de dependencias.
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<paymentdocument>,
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
    @InjectModel(AbonoApartamento.name)
    private readonly abonoModel: Model<AbonoApartamentoDocument>,
  ) {}

  async build(
    buildingId: Types.ObjectId,
    filtro: FiltroCobranza = 'todos',
  ): Promise<ReporteCobranza> {
    const [apartamentos, recibos, pagosPendientes, owners, abonos] =
      await Promise.all([
        this.apartmentModel
          .find({ buildingId }, { piso: 1, numero: 1, idUnico: 1 })
          .sort({ piso: 1, numero: 1 })
          .lean()
          .exec(),
        // Solo recibos con saldo: los pagados completos no afectan clasificación.
        this.reciboModel
          .find(
            { buildingId, $expr: { $lt: ['$montoPagado', '$montoUsd'] } },
            {
              piso: 1,
              apartamento: 1,
              meses: 1,
              montoUsd: 1,
              montoPagado: 1,
              tipoDeuda: 1,
            },
          )
          .lean()
          .exec(),
        this.paymentModel
          .find(
            { buildingId, estado: 'pendiente' },
            { piso: 1, apartamento: 1, montoUsd: 1 },
          )
          .lean()
          .exec(),
        this.ownerModel
          .find(
            { buildingId, activo: true },
            { piso: 1, apartamento: 1, nombre: 1, email: 1 },
          )
          .lean()
          .exec(),
        this.abonoModel
          .find({ buildingId }, { piso: 1, apartamento: 1, monto: 1 })
          .lean()
          .exec(),
      ]);

    const recibosPorApto = new Map<string, ReciboCobranzaInput[]>();
    for (const r of recibos) {
      const clave = claveApto(r.piso, r.apartamento);
      const lista = recibosPorApto.get(clave) ?? [];
      lista.push(r);
      recibosPorApto.set(clave, lista);
    }

    const pagosPorApto = new Map<string, PagoPendienteInput[]>();
    for (const p of pagosPendientes) {
      const clave = claveApto(p.piso, p.apartamento);
      const lista = pagosPorApto.get(clave) ?? [];
      lista.push({
        piso: p.piso,
        apartamento: p.apartamento,
        montoUsd: p.montoUsd,
      });
      pagosPorApto.set(clave, lista);
    }

    const ownerPorApto = new Map(
      owners.map((o) => [claveApto(o.piso, o.apartamento), o]),
    );
    const abonoPorApto = new Map(
      abonos.map((a) => [claveApto(a.piso, a.apartamento), a.monto ?? 0]),
    );

    const filas: FilaCobranzaDetalle[] = apartamentos.map((apt) => {
      const clave = claveApto(apt.piso, apt.numero);
      const owner = ownerPorApto.get(clave);
      const fila = construirFilaCobranza({
        piso: apt.piso,
        apartamento: apt.numero,
        recibos: recibosPorApto.get(clave) ?? [],
        abonoUsd: abonoPorApto.get(clave) ?? 0,
        pagosPendientes: pagosPorApto.get(clave) ?? [],
      });
      return {
        ...fila,
        idUnico: apt.idUnico,
        propietario: owner?.nombre ?? null,
        emailPropietario: owner?.email ?? null,
      };
    });

    // El resumen siempre es del edificio completo; el filtro solo recorta filas.
    const resumen = {
      totalApartamentos: filas.length,
      alDia: filas.filter((f) => f.categoria === 'al_dia').length,
      morosos: filas.filter((f) => f.categoria === 'moroso').length,
      enRevision: filas.filter((f) => f.tienePagoEnRevision).length,
    };

    return {
      generadoEn: new Date().toISOString(),
      resumen,
      filas:
        filtro === 'todos'
          ? filas
          : filas.filter((f) => f.categoria === filtro),
    };
  }

  /** Genera el buffer Excel a partir del reporte ya construido (modo sinc fallback). */
  async buildExcel(
    buildingId: Types.ObjectId,
    filtro: FiltroCobranza = 'todos',
  ): Promise<Buffer> {
    const reporte = await this.build(buildingId, filtro);
    return buildCobranzaWorkbook(reporte);
  }
}
