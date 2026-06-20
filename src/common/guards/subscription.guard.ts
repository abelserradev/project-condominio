import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { BuildingsService } from '../../buildings/buildings.service';

// Se aplica SOLO a rutas de admin (crear recibos, aceptar pagos, gestionar avisos).
// Los propietarios siempre pueden leer su data aunque la suscripción esté vencida.
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly buildingsService: BuildingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const building = req.building;

    if (!building) {
      // BuildingContextGuard debe ejecutarse antes de este guard
      throw new ForbiddenException('Contexto de edificio no resuelto');
    }

    if (building.estadoSuscripcion === 'suspendido') {
      throw new ForbiddenException('Cuenta suspendida. Contacte al administrador de la plataforma.');
    }

    const hoy = new Date();
    const fechaLimite = new Date(building.suscripcionHasta);
    fechaLimite.setDate(fechaLimite.getDate() + (building.diasGracia ?? 3));

    if (hoy > fechaLimite) {
      // Fire-and-forget: actualizar estado en BD si no está marcado como vencido
      // TODO: Mover esto a un cron diario cuando haya muchos edificios
      if (building.estadoSuscripcion !== 'vencido') {
        this.buildingsService.marcarVencido(building._id).catch(() => {});
      }
      throw new ForbiddenException('Suscripción vencida. Renueva tu plan para continuar.');
    }

    return true;
  }
}
