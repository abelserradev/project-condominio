import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { URL } from 'node:url';
import { AdministracionController } from './administracion.controller';
import { AdministracionService } from './administracion.service';
import { AbonoApartamentoService } from './abono-apartamento.service';
import { CobranzaReportService } from './cobranza-report.service';
import { CobranzaSnapshotService } from './cobranza-snapshot.service';
import { CobranzaExcelJobService } from './cobranza-excel-job.service';
import { CobranzaExcelJobProcessor } from './cobranza-excel-job.processor';
import { CobranzaExcelJobFacade } from './cobranza-excel-job.facade';
import { Recibo, ReciboSchema } from './schemas/recibo.schema';
import {
  CobranzaSnapshot,
  CobranzaSnapshotSchema,
} from './schemas/cobranza-snapshot.schema';
import {
  CobranzaReportJob,
  CobranzaReportJobSchema,
} from './schemas/cobranza-report-job.schema';
import {
  AbonoApartamento,
  AbonoApartamentoSchema,
} from './schemas/abono-apartamento.schema';
import {
  Apartment,
  apartmentschema,
} from '../apartments/schemas/apartment.schema';
import { Payment, paymentschema } from '../payments/schemas/payment.schema';
import { Owner, OwnerSchema } from '../owners/schemas/owner.schema';
import { FilesModule } from '../files/files.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

/**
 * Opciones de Redis para BullMQ. Si no hay REDIS_URL, fallback a localhost:6379
 * (el mismo default de ioredis). En dev sin Redis, el worker falla al inicio;
 * para evitar eso se usa el flag DISABLE_BULLMQ_WORKERS en dev sin cola.
 */
function redisConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const u = new URL(url);
    return {
      host: u.hostname || 'localhost',
      port: Number.parseInt(u.port || '6379', 10),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Recibo.name, schema: ReciboSchema },
      { name: AbonoApartamento.name, schema: AbonoApartamentoSchema },
      { name: Apartment.name, schema: apartmentschema },
      { name: Payment.name, schema: paymentschema },
      { name: Owner.name, schema: OwnerSchema },
      { name: CobranzaSnapshot.name, schema: CobranzaSnapshotSchema },
      { name: CobranzaReportJob.name, schema: CobranzaReportJobSchema },
    ]),
    BullModule.registerQueue({
      name: 'cobranza-excel',
      connection: redisConnection(),
    }),
    FilesModule,
    AuthModule,
    CommonModule,
  ],
  controllers: [AdministracionController],
  providers: [
    AdministracionService,
    AbonoApartamentoService,
    CobranzaReportService,
    CobranzaSnapshotService,
    CobranzaExcelJobService,
    ...(process.env.DISABLE_BULLMQ_WORKERS === 'true'
      ? []
      : [CobranzaExcelJobProcessor]),
    CobranzaExcelJobFacade,
  ],
  exports: [
    AdministracionService,
    AbonoApartamentoService,
    CobranzaSnapshotService,
  ],
})
export class AdministracionModule {}
