import { Controller, Get, Param, Header } from '@nestjs/common';
import { TasaBcvService } from './tasa-bcv.services';

@Controller('tasa-bcv')
export class TasaBcvController {
  constructor(private readonly tasaBcvService: TasaBcvService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async getTasa() {
    return this.tasaBcvService.getTasa();
  }

  @Get(':fecha')
  @Header('Cache-Control', 'no-store')
  async getTasaPorFecha(@Param('fecha') fecha: string) {
    return this.tasaBcvService.getTasaPorFecha(fecha);
  }
}
