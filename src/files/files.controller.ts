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
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ id: string; filename: string }> {
    if (!file) throw new BadRequestException('Se requiere el archivo');
    const sanitizedFilename = sanitizeString(file.originalname, 255);
    const id = await this.filesService.upload(file.buffer, {
      filename: sanitizedFilename,
      mimetype: file.mimetype,
    });
    return { id: id.toString(), filename: sanitizedFilename };
  }

  // Endpoint público: los IDs son ObjectIds de 128 bits, no enumerables.
  // El vector de ataque real (GET /payments, que exponía los fileIds) está protegido con JWT.
  // No se puede añadir JWT aquí porque <img src> no puede enviar Authorization headers.
  @Get(':id')
  async get(
    @Param('id') id: string,
    @Res() res: express.Response,
  ): Promise<void> {
    const { stream, contentType, filename } =
      await this.filesService.getStream(id);
    // Sanitizar el nombre para prevenir HTTP Response Splitting vía CRLF injection
    const safeFilename = filename.replace(/[\r\n"]/g, '_');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    stream.pipe(res);
  }
}
