import { Controller, Get } from '@nestjs/common';
import { TasaBcvService } from './tasa-bcv.services';

@Controller('tasa-bcv')
export class TasaBcvController {
  constructor(private readonly tasaBcvService: TasaBcvService) {}

  @Get()
  async getTasa() {
    return this.tasaBcvService.getTasa();
  }
}