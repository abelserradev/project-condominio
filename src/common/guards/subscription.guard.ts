import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { BuildingsService } from '../../buildings/buildings.service';
import { evaluarAccesoPortal } from '../../buildings/utils/portal-access.util';
import { RequestWithBuilding } from '../types/http-request.types';

// Bloquea lecturas y escrituras tenant cuando la suscripción está suspendida o vencida.
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly buildingsService: BuildingsService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RequestWithBuilding>();
    const building = req.building;

    if (!building) {
      throw new ForbiddenException('Contexto de edificio no resuelto');
    }

    const acceso = evaluarAccesoPortal(building);
    if (acceso.portalAccesible) {
      return true;
    }

    if (acceso.motivoBloqueo === 'vencido') {
      if (building.estadoSuscripcion !== 'vencido') {
        this.buildingsService.marcarVencido(building._id).catch(() => {});
      }
      throw new ForbiddenException({
        message: 'Suscripción vencida. Renueva tu plan para continuar.',
        motivoBloqueo: 'vencido',
      });
    }

    throw new ForbiddenException({
      message: 'Cuenta suspendida. Contacte al administrador de la plataforma.',
      motivoBloqueo: 'suspendido',
    });
  }
}
