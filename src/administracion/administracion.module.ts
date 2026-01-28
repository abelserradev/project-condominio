import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';
import { Recibo, ReciboSchema } from './schemas/recibo.schema';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Recibo.name, schema: ReciboSchema },
    ]),
    FilesModule,
    AuthModule,
    CommonModule,
  ],
  controllers: [AdministracionController],
  providers: [AdministracionService],
  exports: [AdministracionService],
})
export class AdministracionModule {}
