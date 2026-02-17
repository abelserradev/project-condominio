import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Aviso, AvisoSchema } from './schemas/aviso.schema';
import { AvisosService } from './avisos.service';
import { AvisosController } from './avisos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Aviso.name, schema: AvisoSchema }]),
    AuthModule,
  ],
  controllers: [AvisosController],
  providers: [AvisosService],
  exports: [AvisosService],
})
export class AvisosModule {}