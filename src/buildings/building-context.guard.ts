import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { RequestWithMutableBuilding } from '../common/types/http-request.types';

@Injectable()
export class BuildingContextGuard implements CanActivate {
  constructor(private readonly buildingsService: BuildingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithMutableBuilding>();
    const slugHeader = req.headers['x-building-slug'];
    const slug = typeof slugHeader === 'string' ? slugHeader : undefined;

    if (!slug || slug.trim() === '') {
      throw new BadRequestException(
        'Edificio no especificado. Incluye el header x-building-slug.',
      );
    }

    const building = await this.buildingsService.findBySlug(slug.trim());

    if (!building) {
      throw new NotFoundException('Edificio no encontrado');
    }

    req.building = building;
    return true;
  }
}
