import { Module } from '@nestjs/common';
import { ReglamentosController } from './reglamentos.controller';
import { BuildingsModule } from '../buildings/buildings.module';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { BuildingTenantGuardsModule } from '../buildings/building-tenant-guards.module';

@Module({
  imports: [
    BuildingsModule,
    FilesModule,
    AuthModule,
    CommonModule,
    BuildingTenantGuardsModule,
  ],
  controllers: [ReglamentosController],
})
export class ReglamentosModule {}
