import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';
import { Apartment, apartmentschema } from './schemas/apartment.schema';
import { CommonModule } from '../common/common.module';
import { BuildingTenantGuardsModule } from '../buildings/building-tenant-guards.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Apartment.name, schema: apartmentschema },
    ]),
    CommonModule,
    BuildingTenantGuardsModule,
  ],
  controllers: [ApartmentsController],
  providers: [ApartmentsService],
  exports: [ApartmentsService],
})
export class ApartmentsModule {}
