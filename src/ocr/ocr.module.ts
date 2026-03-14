import { Module } from '@nestjs/common';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';
import { TesseractOcrEngine } from './engines/tesseract/tesseract-ocr.engine';
import { OllamaBankLogoService } from './services/ollama-bank-logo.service';
import { OCR_ENGINE } from './ocr.service';

@Module({
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