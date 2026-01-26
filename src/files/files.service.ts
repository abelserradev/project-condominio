import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Readable } from 'stream';
import * as mongoose from 'mongoose';

const BUCKET_NAME = 'archivos';

@Injectable()
export class FilesService {
  private bucket: mongoose.mongo.GridFSBucket;

  constructor(@InjectConnection() private connection: Connection) {
    this.bucket = new mongoose.mongo.GridFSBucket(this.connection.db as mongoose.mongo.Db, {
      bucketName: BUCKET_NAME,
    });
  }

  async upload(
    buffer: Buffer,
    metadata: { filename: string; mimetype?: string },
  ): Promise<mongoose.Types.ObjectId> {
    return new Promise((resolve, reject) => {
      const stream = this.bucket.openUploadStream(metadata.filename, {
        metadata: { mimetype: metadata.mimetype ?? 'application/octet-stream' },
      });
      const readable = Readable.from(buffer);
      readable.pipe(stream);
      stream.on('finish', () => resolve(stream.id as mongoose.Types.ObjectId));
      stream.on('error', reject);
    });
  }

  async getStream(id: string): Promise<{ stream: Readable; contentType: string; filename: string }> {
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
      (file.metadata as { mimetype?: string })?.mimetype ?? 'application/octet-stream';
    return { stream, contentType, filename: file.filename ?? 'file' };
  }
}
