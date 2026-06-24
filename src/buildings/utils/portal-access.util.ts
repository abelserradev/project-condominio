import { BuildingDocument } from '../schemas/building.schema';

export type MotivoBloqueoPortal = 'suspendido' | 'vencido';

export type PortalAccessResult = {
  portalAccesible: boolean;
  motivoBloqueo?: MotivoBloqueoPortal;
};

/** Centraliza la regla de bloqueo del portal tenant (suspendido o vencido post-gracia). */
export function evaluarAccesoPortal(
  building: Pick<
    BuildingDocument,
    'estadoSuscripcion' | 'suscripcionHasta' | 'diasGracia'
  >,
): PortalAccessResult {
  if (building.estadoSuscripcion === 'suspendido') {
    return { portalAccesible: false, motivoBloqueo: 'suspendido' };
  }
  if (!building.suscripcionHasta) {
    return { portalAccesible: true };
  }
  const hoy = new Date();
  const fechaLimite = new Date(building.suscripcionHasta);
  fechaLimite.setDate(fechaLimite.getDate() + (building.diasGracia ?? 3));
  if (hoy > fechaLimite) {
    return { portalAccesible: false, motivoBloqueo: 'vencido' };
  }
  return { portalAccesible: true };
}
