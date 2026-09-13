import { Module } from '@nestjs/common';
import { BuildingsModule } from './buildings.module';

/** Facade para módulos tenant que solo necesitan guards + BuildingsService exportados. */
@Module({
  imports: [BuildingsModule],
  exports: [BuildingsModule],
})
export class BuildingTenantGuardsModule {}
