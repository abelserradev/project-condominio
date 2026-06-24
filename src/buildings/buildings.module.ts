import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuildingsController } from './buildings.controller';
import { BuildingsService } from './buildings.service';
import { Building, BuildingSchema } from './schemas/building.schema';
import { AuthModule } from '../auth/auth.module';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Building.name, schema: BuildingSchema },
    ]),
    forwardRef(() => AuthModule),
    CommonModule,
  ],
  controllers: [BuildingsController],
  providers: [BuildingsService, BuildingContextGuard],
  exports: [BuildingsService, MongooseModule],
})
export class BuildingsModule {}
