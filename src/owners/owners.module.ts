import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { Owner, OwnerSchema } from './schemas/owner.schema';
import { AuthCoreModule } from '../auth/auth-core.module';
import { BuildingsModule } from '../buildings/buildings.module';
import { BuildingTenantGuardsModule } from '../buildings/building-tenant-guards.module';
import {
  Apartment,
  apartmentschema,
} from '../apartments/schemas/apartment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Owner.name, schema: OwnerSchema },
      { name: Apartment.name, schema: apartmentschema },
    ]),
    AuthCoreModule,
    forwardRef(() => BuildingsModule),
    BuildingTenantGuardsModule,
  ],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService],
})
export class OwnersModule {}
