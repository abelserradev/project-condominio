import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import type { IOcrEngine } from '../../interfaces/ocr-engine.interface';
import type { ExtractionResult } from '../../interfaces/extraction-result.interface';

/**
 * OCR con Tesseract.js: sin tokens, 100% local.
 * Extrae texto de la imagen y el parser aplica regex para banco, fecha, monto, etc.
 */
@Injectable()
export class TesseractOcrEngine implements IOcrEngine {
  private readonly logger = new Logger(TesseractOcrEngine.name);

  async extract(imageBuffer: Buffer, _options?: unknown): Promise<ExtractionResult> {
    const worker = await createWorker('spa+eng', 1, {
      logger: () => {},
    });
    try {
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      this.logger.log(`Tesseract extrajo ${text.length} caracteres`);
      return {
        raw: text,
        structured: undefined,
        engine: 'tesseract',
      };
    } finally {
      await worker.terminate();
    }
  }
}
