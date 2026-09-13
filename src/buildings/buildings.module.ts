import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { Building, BuildingSchema } from './schemas/building.schema';
import { AuthCoreModule } from '../auth/auth-core.module';
import { MailModule } from '../common/mail.module';
import { BuildingContextGuard } from './building-context.guard';
import { SubscriptionGuard } from './subscription.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
    ]),
    AuthCoreModule,
    MailModule,
  ],
  controllers: [BuildingsController],
  providers: [BuildingsService, BuildingContextGuard, SubscriptionGuard],
  exports: [
    BuildingsService,
    MongooseModule,
    BuildingContextGuard,
    SubscriptionGuard,
  ],
})
export class BuildingsModule {}
