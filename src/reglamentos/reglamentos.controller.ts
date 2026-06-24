import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { BuildingsService } from '../buildings/buildings.service';
import { FilesService } from '../files/files.service';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import { validateFileMimeType } from '../common/utils/file-validation.util';

type RequestWithBuilding = { building: BuildingDocument };

const MAX_PDF_BYTES = 10 * 1024 * 1024;

@Controller('reglamentos')
export class ReglamentosController {
  constructor(
    private readonly buildingsService: BuildingsService,
    private readonly filesService: FilesService,
  ) {}

  @Get()
  @UseGuards(BuildingContextGuard)
  async obtener(@Req() req: RequestWithBuilding) {
    const reglamento = await this.buildingsService.getReglamento(
      req.building._id,
    );
    if (!reglamento) {
      throw new NotFoundException(
        'El administrador aún no ha publicado el reglamento',
      );
    }
    return reglamento;
  }

  @Post()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_PDF_BYTES } }),
  )
  async subir(
    @Req() req: RequestWithBuilding,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe adjuntar un archivo PDF');
    }
    const mime = validateFileMimeType(
      file.buffer,
      file.mimetype ?? 'application/pdf',
    );
    if (mime !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF');
    }
    const fileId = await this.filesService.upload(file.buffer, {
      filename: file.originalname ?? 'reglamento.pdf',
      mimetype: 'application/pdf',
    });
    await this.buildingsService.setReglamento(
      req.building._id,
      fileId,
      file.originalname ?? 'reglamento.pdf',
    );
    return this.buildingsService.getReglamento(req.building._id);
  }

  @Delete()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async eliminar(@Req() req: RequestWithBuilding) {
    await this.buildingsService.clearReglamento(req.building._id);
    return { ok: true };
  }
}
