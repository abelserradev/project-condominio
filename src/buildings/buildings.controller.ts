import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { BuildingsService } from './buildings.service';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildingDocument } from './schemas/building.schema';

type BuildingRequest = {
  building: BuildingDocument;
  user?: { buildingId?: string; isSuperAdmin?: boolean };
};

@Controller('buildings')
export class BuildingsController {
  constructor(private readonly buildingsService: BuildingsService) {}

  @Get('check-slug/:slug')
  async checkSlug(@Param('slug') slug: string) {
    const slugNorm = slug.toLowerCase().trim();
    if (this.buildingsService.isSlugReservado(slugNorm)) {
      return { disponible: false, motivo: 'reservado' };
    }
    const existente = await this.buildingsService.findBySlug(slugNorm);
    return { disponible: !existente };
  }

  @Get('suscripcion')
  @UseGuards(BuildingContextGuard, JwtAuthGuard)
  async getSuscripcion(@Req() req: BuildingRequest) {
    const info = await this.buildingsService.getSuscripcionInfo(
      req.building._id,
    );
    if (!info) throw new NotFoundException('Edificio no encontrado');
    return info;
  }

  @Get(':slug')
  async findBySlug(@Param('slug') slug: string) {
    const building = await this.buildingsService.findBySlug(slug);
    if (!building) throw new NotFoundException('Edificio no encontrado');
    return {
      _id: building._id,
      nombre: building.nombre,
      slug: building.slug,
      activo: building.activo,
    };
  }
}
