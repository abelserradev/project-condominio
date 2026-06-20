import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { Types } from 'mongoose';
import { BuildingDocument } from '../buildings/schemas/building.schema';

type RequestWithBuilding = { building: BuildingDocument };

@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get()
  @UseGuards(BuildingContextGuard)
  async findAll(@Req() req: RequestWithBuilding, @Query('piso') piso?: string) {
    const buildingId = req.building._id as Types.ObjectId;
    if (piso != null && piso !== '') {
      const n = parseInt(piso, 10);
      if (!Number.isNaN(n)) return this.apartmentsService.findByPiso(n, buildingId);
    }
    return this.apartmentsService.findAll(buildingId);
  }

  @Get(':idUnico')
  @UseGuards(BuildingContextGuard)
  async findByIdUnico(@Req() req: RequestWithBuilding, @Param('idUnico') idUnico: string) {
    const buildingId = req.building._id as Types.ObjectId;
    return this.apartmentsService.findByIdUnico(idUnico, buildingId);
  }
}
