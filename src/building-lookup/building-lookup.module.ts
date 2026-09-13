import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Building, BuildingSchema } from '../entities/building.schema';
import { BuildingLookupService } from './building-lookup.service';
import { BUILDING_LOOKUP } from './building-lookup.port';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
    ]),
  ],
  providers: [
    BuildingLookupService,
    {
      provide: BUILDING_LOOKUP,
      useExisting: BuildingLookupService,
    },
  ],
  exports: [BUILDING_LOOKUP, BuildingLookupService],
})
export class BuildingLookupModule {}
