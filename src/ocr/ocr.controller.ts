import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';
import { validateFileMimeType, validateFileSize } from '../common/utils/file-validation.util';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const OCR_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('ocr')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(private readonly ocrService: OcrService) {}

  @Post('extract-receipt')
  @UseInterceptors(
    FileInterceptor('comprobante', { limits: { fileSize: MAX_SIZE_BYTES } }),
  )
  async extractReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file?.buffer) {
      throw new BadRequestException('Debe subir un comprobante (imagen).');
    }

    validateFileSize(file.buffer, MAX_SIZE_BYTES);
    const validatedMime = validateFileMimeType(file.buffer, file.mimetype);

    if (!OCR_ALLOWED_MIMES.includes(validatedMime)) {
      throw new BadRequestException(
        'Formato no soportado para OCR. Use JPEG, PNG o WebP.',
      );
    }

    try {
      const result = await this.ocrService.extraerComprobante(file.buffer);
      return result;
    } catch (err) {
      this.logger.warn(
        `OCR falló: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(
        'No pudimos leer el comprobante automáticamente. Por favor complete los datos manualmente.',
      );
    }
  }
}
