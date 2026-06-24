import { Module } from '@nestjs/common';
import { ReglamentosController } from './reglamentos.controller';
import { BuildingsModule } from '../buildings/buildings.module';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [BuildingsModule, FilesModule, AuthModule, CommonModule],
  controllers: [ReglamentosController],
})
export class ReglamentosModule {}
