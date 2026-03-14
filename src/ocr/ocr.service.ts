import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IOcrEngine } from './interfaces/ocr-engine.interface';
import type { ComprobanteExtractionDto } from './dto/comprobante-extraction.dto';
import { parseComprobanteResponse } from './parsers/comprobante-response.parser';
import { OllamaBankLogoService } from './services/ollama-bank-logo.service';

export const OCR_ENGINE = Symbol('OCR_ENGINE');

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    @Inject(OCR_ENGINE) private readonly engine: IOcrEngine,
    private readonly ollamaBankLogo: OllamaBankLogoService,
  ) {}

  async extraerComprobante(imageBuffer: Buffer): Promise<ComprobanteExtractionDto> {
    const result = await this.engine.extract(imageBuffer);
    this.logger.log(`OCR raw (primeros 300 chars): ${result.raw.slice(0, 300)}`);
    const dto = parseComprobanteResponse(result);

    if (!dto.banco && /banco\s+destino/i.test(result.raw)) {
      const bancoPorLogo = await this.ollamaBankLogo.identificarBancoPorLogo(
        imageBuffer,
      );
      if (bancoPorLogo) {
        dto.banco = bancoPorLogo;
        this.logger.log(`Banco inferido por logo: ${bancoPorLogo}`);
      }
    }

    this.logger.log(`OCR parsed: ${JSON.stringify(dto)}`);
    return dto;
  }
}