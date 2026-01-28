import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 85;
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

@Injectable()
export class ImageCompressionService {
  async compressImage(
    buffer: Buffer,
    mimetype?: string,
  ): Promise<{ buffer: Buffer; mimetype: string }> {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`);
    }

    const isImage = mimetype?.startsWith('image/');
    if (!isImage) {
      return { buffer, mimetype: mimetype ?? 'application/octet-stream' };
    }

    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      const needsResize =
        (metadata.width && metadata.width > MAX_WIDTH) ||
        (metadata.height && metadata.height > MAX_HEIGHT);

      let processed = image;

      if (needsResize) {
        processed = processed.resize(MAX_WIDTH, MAX_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      const outputFormat = this.getOutputFormat(mimetype);
      const compressedBuffer = await processed
        .toFormat(outputFormat, { quality: QUALITY })
        .toBuffer();

      const finalMimetype = outputFormat === 'jpeg' ? 'image/jpeg' : outputFormat === 'png' ? 'image/png' : mimetype ?? 'image/jpeg';

      return {
        buffer: compressedBuffer,
        mimetype: finalMimetype,
      };
    } catch (err) {
      console.error('[ImageCompressionService] Error al comprimir imagen:', err);
      return { buffer, mimetype: mimetype ?? 'application/octet-stream' };
    }
  }

  private getOutputFormat(mimetype?: string): 'jpeg' | 'png' | 'webp' {
    if (mimetype?.includes('png')) return 'png';
    if (mimetype?.includes('webp')) return 'webp';
    return 'jpeg';
  }

  validateFileSize(buffer: Buffer): void {
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB}MB`);
    }
  }
}
