import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Readable } from 'stream';
import * as mongoose from 'mongoose';
import { ImageCompressionService } from './image-compression.service';
import { validateFileMimeType } from '../common/utils/file-validation.util';

const BUCKET_NAME = 'archivos';

@Injectable()
export class FilesService {
  private bucket: mongoose.mongo.GridFSBucket;

  constructor(
    @InjectConnection() private connection: Connection,
    private readonly imageCompression: ImageCompressionService,
  ) {
    this.bucket = new mongoose.mongo.GridFSBucket(
      this.connection.db as mongoose.mongo.Db,
      {
        bucketName: BUCKET_NAME,
      },
    );
  }

  async upload(
    buffer: Buffer,
    metadata: { filename: string; mimetype?: string },
  ): Promise<mongoose.Types.ObjectId> {
    this.imageCompression.validateFileSize(buffer);
    // Validar tipo MIME real del archivo antes de procesar
    const validatedMimeType = validateFileMimeType(buffer, metadata.mimetype);
    const { buffer: processedBuffer, mimetype: finalMimetype } =
      await this.imageCompression.compressImage(buffer, validatedMimeType);
    return new Promise((resolve, reject) => {
      const stream = this.bucket.openUploadStream(metadata.filename, {
        metadata: { mimetype: finalMimetype },
      });
      const readable = Readable.from(processedBuffer);
      readable.pipe(stream);
      stream.on('finish', () => resolve(stream.id));
      stream.on('error', reject);
    });
  }

  async getStream(
    id: string,
  ): Promise<{ stream: Readable; contentType: string; filename: string }> {
    let objectId: mongoose.Types.ObjectId;
    try {
      objectId = new mongoose.Types.ObjectId(id);
    } catch {
      throw new NotFoundException('Archivo no encontrado');
    }
    const cursor = this.bucket.find({ _id: objectId });
    const files = await cursor.toArray();
    if (!files.length) throw new NotFoundException('Archivo no encontrado');
    const file = files[0];
    const stream = this.bucket.openDownloadStream(objectId);
    const contentType =
      (file.metadata as { mimetype?: string })?.mimetype ??
      'application/octet-stream';
    return { stream, contentType, filename: file.filename ?? 'file' };
  }
}
