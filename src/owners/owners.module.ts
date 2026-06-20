import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { Owner, OwnerSchema } from './schemas/owner.schema';
import { AuthModule } from '../auth/auth.module';
import { BuildingsModule } from '../buildings/buildings.module';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { Apartment, apartmentschema } from '../apartments/schemas/apartment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Owner.name, schema: OwnerSchema },
      { name: Apartment.name, schema: apartmentschema },
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => BuildingsModule),
  ],
  controllers: [OwnersController],
  providers: [OwnersService, BuildingContextGuard, SubscriptionGuard],
  exports: [OwnersService],
})
export class OwnersModule {}
