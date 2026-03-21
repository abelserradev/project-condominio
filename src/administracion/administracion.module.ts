import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';
import { AbonoApartamentoService } from './abono-apartamento.service';
import { Recibo, ReciboSchema } from './schemas/recibo.schema';
import { AbonoApartamento, AbonoApartamentoSchema } from './schemas/abono-apartamento.schema';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Recibo.name, schema: ReciboSchema },
      { name: AbonoApartamento.name, schema: AbonoApartamentoSchema },
    ]),
    FilesModule,
    AuthModule,
    CommonModule,
  ],
  controllers: [AdministracionController],
  providers: [AdministracionService, AbonoApartamentoService],
  exports: [AdministracionService, AbonoApartamentoService],
})
export class AdministracionModule {}
