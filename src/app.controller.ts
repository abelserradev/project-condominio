import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Liveness: orquestadores y balanceadores suelen usar /health sin Origin */
  @Get('health')
  @SkipThrottle()
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
