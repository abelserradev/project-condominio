import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { ImageCompressionService } from './image-compression.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, ImageCompressionService],
  exports: [FilesService],
})
export class FilesModule {}
