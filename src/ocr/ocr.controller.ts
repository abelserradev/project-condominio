import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { OcrService } from './ocr.service';
import {
  validateFileMimeType,
  validateFileSize,
} from '../common/utils/file-validation.util';
import { CacheService } from '../common/cache.service';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import * as crypto from 'crypto';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const OCR_ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('ocr')
export class OcrController {
  private readonly logger = new Logger(OcrController.name);

  constructor(
    private readonly ocrService: OcrService,
    private readonly cacheService: CacheService,
  ) {}

  @Post('extract-receipt')
  @UseGuards(BuildingContextGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

      // Guardar predicción en caché por 2 horas vinculado al hash de la imagen
      const fileHash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');
      await this.cacheService.set(
        `ocr_pred:${fileHash}`,
        result,
        2 * 60 * 60 * 1000,
      );

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
