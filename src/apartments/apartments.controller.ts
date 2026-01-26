import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApartmentsService } from './apartments.service';

@Controller('apartments')
export class ApartmentsController {
  constructor(private readonly apartmentsService: ApartmentsService) {}

  @Get()
  async findAll(@Query('piso') piso?: string) {
    if (piso != null && piso !== '') {
      const n = parseInt(piso, 10);
      if (!Number.isNaN(n)) return this.apartmentsService.findByPiso(n);
    }
    return this.apartmentsService.findAll();
  }

  @Get(':idUnico')
  async findByIdUnico(@Param('idUnico') idUnico: string) {
    return this.apartmentsService.findByIdUnico(idUnico);
  }
}