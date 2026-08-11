import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { BuildingDocument } from '../buildings/schemas/building.schema';

type RequestWithBuilding = { building: BuildingDocument };

@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get()
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async findAll(@Req() req: RequestWithBuilding, @Query('piso') piso?: string) {
    const buildingId = req.building._id;
    const { totalPisos, apartamentosPorPiso } = req.building;

    const ensureSeed = async (): Promise<void> => {
      const existentes = await this.apartmentsService.findAll(buildingId);
      if (existentes.length > 0) return;
      if (totalPisos < 1 || apartamentosPorPiso < 1) return;
      await this.apartmentsService.seedForBuilding(
        buildingId,
        totalPisos,
        apartamentosPorPiso,
      );
    };

    if (piso != null && piso !== '') {
      const n = Number.parseInt(piso, 10);
      if (!Number.isNaN(n)) {
        let list = await this.apartmentsService.findByPiso(n, buildingId);
        if (list.length === 0) {
          await ensureSeed();
          list = await this.apartmentsService.findByPiso(n, buildingId);
        }
        return list;
      }
    }

    let list = await this.apartmentsService.findAll(buildingId);
    if (list.length === 0) {
      await ensureSeed();
      list = await this.apartmentsService.findAll(buildingId);
    }
    return list;
  }

  @Get(':idUnico')
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async findByIdUnico(
    @Req() req: RequestWithBuilding,
    @Param('idUnico') idUnico: string,
  ) {
    const buildingId = req.building._id;
    return this.apartmentsService.findByIdUnico(idUnico, buildingId);
  }
}
