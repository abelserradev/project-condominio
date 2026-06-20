import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OcrService, OCR_ENGINE } from './ocr.service';
import { OcrController } from './ocr.controller';
import { TesseractOcrEngine } from './engines/tesseract/tesseract-ocr.engine';
import { OllamaBankLogoService } from './services/ollama-bank-logo.service';
import { OcrLog, OcrLogSchema } from './schemas/ocr-log.schema';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: OcrLog.name, schema: OcrLogSchema }]),
    CommonModule,
  ],
  controllers: [OcrController],
  providers: [
    TesseractOcrEngine,
    OllamaBankLogoService,
    {
      provide: OCR_ENGINE,
      useExisting: TesseractOcrEngine,
    },
    OcrService,
  ],
  exports: [OcrService],
})
export class OcrModule {}
