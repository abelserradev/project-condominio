import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { IOcrEngine } from './interfaces/ocr-engine.interface';
import type { ComprobanteExtractionDto } from './dto/comprobante-extraction.dto';
import { parseComprobanteResponse } from './parsers/comprobante-response.parser';
import { OllamaBankLogoService } from './services/ollama-bank-logo.service';
import { OcrLog, OcrLogDocument } from './schemas/ocr-log.schema';

export const OCR_ENGINE = Symbol('OCR_ENGINE');

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    @Inject(OCR_ENGINE) private readonly engine: IOcrEngine,
    private readonly ollamaBankLogo: OllamaBankLogoService,
    @InjectModel(OcrLog.name) private readonly ocrLogModel: Model<OcrLogDocument>,
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

  async registrarOcrLog(fileId: string, prediccion: any, datosReales: any) {
    try {
      const pBanco = prediccion.banco?.toLowerCase() || '';
      const rBanco = datosReales.banco?.toLowerCase() || '';
      const pRef = prediccion.numeroComprobante || '';
      const rRef = datosReales.numeroComprobante || '';
      
      const esCorrecto = pBanco === rBanco && pRef === rRef;

      await this.ocrLogModel.create({
        comprobanteFileId: new Types.ObjectId(fileId),
        prediccionMoondream: {
          banco: prediccion.banco,
          montoBs: prediccion.montoBs,
          fechaPago: prediccion.fechaPago,
          numeroComprobante: prediccion.numeroComprobante,
        },
        datosRealesUsuario: {
          banco: datosReales.banco,
          montoBs: datosReales.montoBs,
          fechaPago: datosReales.fechaPago,
          numeroComprobante: datosReales.numeroComprobante,
        },
        esCorrecto,
      });
      this.logger.log(`OCR Log registrado para comp. ${fileId} - Correcto: ${esCorrecto}`);
    } catch (e: any) {
      this.logger.error(`Error guardando OCR Log: ${e.message}`);
    }
  }
}