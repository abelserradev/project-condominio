export class BuildingEntity {
  slug: string;
  nombre: string;
  direccion?: string;
  totalPisos: number;
  apartamentosPorPiso: number;
  activo: boolean;
  estadoSuscripcion: string;
  datosContactoPago?: string;
}
