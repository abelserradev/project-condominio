import { Controller, Get, Param } from '@nestjs/common';
import { TasaBcvService } from './tasa-bcv.services';

@Controller('tasa-bcv')
export class TasaBcvController {
  constructor(private readonly tasaBcvService: TasaBcvService) {}

  @Get()
  async getTasa() {
    return this.tasaBcvService.getTasa();
  }

  @Get(':fecha')
  async getTasaPorFecha(@Param('fecha') fecha: string) {
    return this.tasaBcvService.getTasaPorFecha(fecha);
  }
}