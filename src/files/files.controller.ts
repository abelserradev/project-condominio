import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesService } from './files.service';
import { sanitizeString } from '../common/utils/security.util';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ id: string; filename: string }> {
    if (!file) throw new BadRequestException('Se requiere el archivo');
    // Sanitizar el nombre del archivo para prevenir path traversal
    const sanitizedFilename = sanitizeString(file.originalname, 255);
    const id = await this.filesService.upload(file.buffer, {
      filename: sanitizedFilename,
      mimetype: file.mimetype,
    });
    return { id: id.toString(), filename: sanitizedFilename };
  }

  @Get(':id')
  async get(
    @Param('id') id: string,
    @Res() res: express.Response,
  ): Promise<void> {
    const { stream, contentType, filename } = await this.filesService.getStream(id);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    stream.pipe(res);
  }
}
