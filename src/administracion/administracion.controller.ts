import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdministracionService } from './administracion.service';
import { Types } from 'mongoose';

@Controller('administracion')
export class AdministracionController {
  constructor(private readonly administracionService: AdministracionService) {}

  @Get('public/pendientes')
  async findPendientesPublicos(
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p =
      piso != null && piso !== '' ? parseInt(piso, 10) : undefined;
    const a =
      apartamento != null && apartamento !== ''
        ? parseInt(apartamento, 10)
        : undefined;
    if (p == null || a == null || Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento requeridos');
    }
    const list = await this.administracionService.findPendientesConSaldo({
      piso: p,
      apartamento: a,
    });
    return list.map((x) => {
      const row = x as unknown as Record<string, unknown>;
      const fid = row.facturaFileId as { toString?: () => string } | undefined;
      return {
        ...row,
        facturaFileId: fid?.toString?.() ?? null,
      };
    });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('piso') piso: string,
    @Body('apartamento') apartamento: string,
    @Body('meses') mesesRaw: string,
    @Body('montoUsd') montoUsd: string,
    @Body('tipoDeuda') tipoDeuda: string,
    @Body('fechaReportada') fechaReportada: string,
  ) {
    if (!file) {
      throw new BadRequestException('Se requiere la factura');
    }
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`El archivo excede el tamaño máximo de ${MAX_SIZE_MB}MB`);
    }
    const p = parseInt(piso ?? '', 10);
    const a = parseInt(apartamento ?? '', 10);
    if (Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento inválidos');
    }
    let meses: number[];
    try {
      meses = JSON.parse(mesesRaw ?? '[]') as number[];
    } catch {
      throw new BadRequestException('meses inválido');
    }
    if (!Array.isArray(meses) || meses.length === 0) {
      throw new BadRequestException('Se requiere al menos un mes');
    }
    const monto = parseFloat(montoUsd ?? '');
    if (Number.isNaN(monto)) {
      throw new BadRequestException('montoUsd inválido');
    }
    if (!tipoDeuda?.trim() || !fechaReportada?.trim()) {
      throw new BadRequestException('tipoDeuda y fechaReportada requeridos');
    }
    const recibo = await this.administracionService.create({
      piso: p,
      apartamento: a,
      meses,
      montoUsd: monto,
      tipoDeuda: tipoDeuda.trim(),
      fechaReportada: fechaReportada.trim(),
      facturaBuffer: file.buffer,
      facturaFilename: file.originalname,
      facturaMimetype: file.mimetype,
    });
    const out = recibo as unknown as Record<string, unknown>;
    const fid = out.facturaFileId as { toString?: () => string } | undefined;
    return {
      ...out,
      facturaFileId: fid?.toString?.() ?? null,
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
    @Query('estado') estado: string,
  ) {
    const p =
      piso != null && piso !== '' ? parseInt(piso, 10) : undefined;
    const a =
      apartamento != null && apartamento !== ''
        ? parseInt(apartamento, 10)
        : undefined;
    const list = await this.administracionService.findAll({
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estado != null && estado !== '' ? estado : undefined,
    });
    return list.map((x) => {
      const row = x as unknown as Record<string, unknown>;
      const fid = row.facturaFileId as { toString?: () => string } | undefined;
      return {
        ...row,
        facturaFileId: fid?.toString?.() ?? null,
      };
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('ID requerido');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const recibo = await this.administracionService.findById(id);
    if (!recibo) {
      throw new NotFoundException('Recibo no encontrado');
    }
    const row = recibo as unknown as Record<string, unknown>;
    const fid = row.facturaFileId as { toString?: () => string } | undefined;
    return {
      ...row,
      facturaFileId: fid?.toString?.() ?? null,
    };
  }
}
