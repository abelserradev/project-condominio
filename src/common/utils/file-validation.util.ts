import { BadRequestException } from '@nestjs/common';

/**
 * Magic bytes para identificar tipos de archivo reales
 * Esto previene que archivos maliciosos se suban con extensiones falsas
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // WebP tiene un header más complejo, esto es básico
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

/**
 * Valida que el tipo MIME real del archivo coincida con el declarado
 * Compara los magic bytes del archivo con las firmas conocidas
 */
export function validateFileMimeType(buffer: Buffer, declaredMimeType?: string): string {
  if (buffer.length < 8) {
    throw new BadRequestException('Archivo inválido o corrupto');
  }

  // Si no hay MIME type declarado, intentar detectarlo
  if (!declaredMimeType) {
    const detected = detectMimeType(buffer);
    if (!detected) {
      throw new BadRequestException('Tipo de archivo no soportado');
    }
    return detected;
  }

  // Validar que el MIME type declarado esté permitido
  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
    throw new BadRequestException(`Tipo de archivo no permitido: ${declaredMimeType}`);
  }

  // Verificar que los magic bytes coincidan con el MIME type declarado
  const detectedMimeType = detectMimeType(buffer);
  if (!detectedMimeType) {
    throw new BadRequestException('No se pudo verificar el tipo de archivo');
  }

  // Para PDF, permitir más flexibilidad ya que puede tener variaciones
  if (declaredMimeType === 'application/pdf' && detectedMimeType === 'application/pdf') {
    return declaredMimeType;
  }

  // Para imágenes, el tipo detectado debe coincidir exactamente
  if (detectedMimeType !== declaredMimeType) {
    throw new BadRequestException(
      `Tipo de archivo no coincide. Declarado: ${declaredMimeType}, Real: ${detectedMimeType}`,
    );
  }

  return declaredMimeType;
}

/**
 * Detecta el tipo MIME real del archivo basándose en magic bytes
 */
function detectMimeType(buffer: Buffer): string | null {
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const signature of signatures) {
      if (buffer.length < signature.length) {
        continue;
      }
      const matches = signature.every((byte, index) => buffer[index] === byte);
      if (matches) {
        return mimeType;
      }
    }
  }
  return null;
}

/**
 * Valida el tamaño del archivo
 */
export function validateFileSize(buffer: Buffer, maxSizeBytes: number): void {
  if (buffer.length > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024);
    throw new BadRequestException(`El archivo excede el tamaño máximo de ${maxSizeMB}MB`);
  }
}
