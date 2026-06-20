import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, paymentschema } from './schemas/payment.schema';
import { FilesModule } from '../files/files.module';
import { AdministracionModule } from '../administracion/administracion.module';
import { CommonModule } from '../common/common.module';
import { OcrModule } from '../ocr/ocr.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: paymentschema }]),
    FilesModule,
    forwardRef(() => AdministracionModule),
    CommonModule,
    OcrModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
