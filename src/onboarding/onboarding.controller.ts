import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { RegisterBuildingDto } from '../buildings/dto/register-building.dto';
import { OnboardingService } from './onboarding.service';

@Controller('buildings')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('register')
  @UseGuards(CsrfGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async register(@Body() dto: RegisterBuildingDto) {
    return this.onboardingService.registerBuilding(dto);
  }
}
