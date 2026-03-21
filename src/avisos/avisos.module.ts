import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Aviso, AvisoSchema } from './schemas/aviso.schema';
import { AvisosService } from './avisos.service';
import { AvisosController } from './avisos.controller';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Aviso.name, schema: AvisoSchema }]),
    AuthModule,
    CommonModule,
  ],
  controllers: [AvisosController],
  providers: [AvisosService],
  exports: [AvisosService],
})
export class AvisosModule {}