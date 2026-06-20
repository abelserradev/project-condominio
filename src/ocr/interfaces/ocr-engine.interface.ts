import type { ExtractionResult } from './extraction-result.interface';

export interface ExtractionOptions {
  prompt?: string;
  schema?: Record<string, unknown>;
}

// contrato que todo motor de vision/OCR debe cumplir
export interface IOcrEngine {
  /**
   * Extrae texto o datos estructurados de una imagen.
   * @param imageBuffer - Imagen en formato Buffer (JPEG, PNG, etc.)
   * @param options - Opciones opcionales (prompt, schema)
   * @returns Resultado con texto crudo y/o datos estructurados
   */
  extract(
    imageBuffer: Buffer,
    options?: ExtractionOptions,
  ): Promise<ExtractionResult>;
}
