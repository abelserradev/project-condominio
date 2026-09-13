import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { evaluarAccesoPortal } from './utils/portal-access.util';
import { RequestWithBuilding } from '../common/types/http-request.types';

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
