import { Module } from '@nestjs/common';
import { BuildingsModule } from '../buildings/buildings.module';
import { ApartmentsModule } from '../apartments/apartments.module';
import { UserModule } from '../user/user.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [BuildingsModule, ApartmentsModule, UserModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
