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
    const id = await this.filesService.upload(file.buffer, {
      filename: file.originalname,
      mimetype: file.mimetype,
    });
    return { id: id.toString(), filename: file.originalname };
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
