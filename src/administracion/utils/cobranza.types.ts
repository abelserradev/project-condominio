import type { FilaCobranza } from './cobranza-classification.util';

/** DTO del reporte — en utils/ para romper SCC administracion↔utils (arch Phase 1). */
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

export type FiltroCobranza = 'todos' | 'al_dia' | 'moroso';
