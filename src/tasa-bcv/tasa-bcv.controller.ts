import { Controller, Get } from '@nestjs/common';
import { tasabcvservice } from './tasa-bcv.services';

@Controller('tasa-bcv')
export class tasabcvcontroller {
  constructor(private readonly tasaBcvService: tasabcvservice) {}

    @Get()
    async getTasa() {
        return this.tasaBcvService.getTasa();
    }
}