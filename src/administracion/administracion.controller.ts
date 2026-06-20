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
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { AdministracionService } from './administracion.service';
import { AbonoApartamentoService } from './abono-apartamento.service';
import { Types } from 'mongoose';
import { mapReciboToResponse } from '../common/utils/serialize-mongoose.util';
import { validateEstado, sanitizeTipoDeuda } from '../common/utils/security.util';
import { validateFileMimeType, validateFileSize } from '../common/utils/file-validation.util';
import { BuildingDocument } from '../buildings/schemas/building.schema';

type RequestWithBuilding = { building: BuildingDocument };

@Controller('administracion')
export class AdministracionController {
  constructor(
    private readonly administracionService: AdministracionService,
    private readonly abonoApartamentoService: AbonoApartamentoService,
  ) {}

  @Get('public/abono')
  @UseGuards(BuildingContextGuard)
  async getAbonoPublico(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p = piso != null && piso !== '' ? parseInt(piso, 10) : undefined;
    const a = apartamento != null && apartamento !== '' ? parseInt(apartamento, 10) : undefined;
    if (p == null || a == null || Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento requeridos');
    }
    const monto = await this.abonoApartamentoService.getMonto(p, a, req.building._id as Types.ObjectId);
    return { monto };
  }

  @Get('public/pendientes')
  @UseGuards(BuildingContextGuard)
  async findPendientesPublicos(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p = piso != null && piso !== '' ? parseInt(piso, 10) : undefined;
    const a = apartamento != null && apartamento !== '' ? parseInt(apartamento, 10) : undefined;
    if (p == null || a == null || Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento requeridos');
    }
    const list = await this.administracionService.findPendientesConSaldo({
      buildingId: req.building._id as Types.ObjectId,
      piso: p,
      apartamento: a,
    });
    return list.map((x) => mapReciboToResponse(x as unknown as Record<string, unknown>));
  }

  @Post()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async create(
    @Req() req: RequestWithBuilding,
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
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    validateFileSize(file.buffer, MAX_SIZE_BYTES);
    const validatedMimeType = validateFileMimeType(file.buffer, file.mimetype);
    const p = parseInt(piso ?? '', 10);
    const a = parseInt(apartamento ?? '', 10);
    if (Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento inválidos');
    }
    let meses: number[];
    try {
      const parsed = JSON.parse(mesesRaw ?? '[]');
      if (!Array.isArray(parsed)) {
        throw new BadRequestException('meses debe ser un array');
      }
      meses = parsed.filter((m: unknown) => typeof m === 'number' && m >= 1 && m <= 12);
      if (meses.length === 0) {
        throw new BadRequestException('Se requiere al menos un mes válido');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('meses inválido');
    }
    const monto = parseFloat(montoUsd ?? '');
    if (Number.isNaN(monto) || monto <= 0) {
      throw new BadRequestException('montoUsd inválido');
    }
    if (!fechaReportada?.trim()) {
      throw new BadRequestException('fechaReportada requerido');
    }
    const tipoDeudaSanitizado = sanitizeTipoDeuda(tipoDeuda);
    const recibo = await this.administracionService.create({
      buildingId: req.building._id as Types.ObjectId,
      piso: p,
      apartamento: a,
      meses,
      montoUsd: monto,
      tipoDeuda: tipoDeudaSanitizado,
      fechaReportada: fechaReportada.trim(),
      facturaBuffer: file.buffer,
      facturaFilename: file.originalname,
      facturaMimetype: validatedMimeType,
    });
    return mapReciboToResponse(recibo as unknown as Record<string, unknown>);
  }

  @Get()
  @UseGuards(JwtAuthGuard, BuildingContextGuard)
  async findAll(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
    @Query('estado') estado: string,
  ) {
    const p = piso != null && piso !== '' ? parseInt(piso, 10) : undefined;
    const a = apartamento != null && apartamento !== '' ? parseInt(apartamento, 10) : undefined;
    const allowedEstados = ['pendiente', 'pagado'];
    const estadoValidado = validateEstado(estado, allowedEstados);
    const list = await this.administracionService.findAll({
      buildingId: req.building._id as Types.ObjectId,
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estadoValidado,
    });
    return list.map((x) => mapReciboToResponse(x as unknown as Record<string, unknown>));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard)
  async findOne(@Param('id') id: string, @Req() req: RequestWithBuilding) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('ID requerido');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const recibo = await this.administracionService.findById(
      id,
      req.building._id as Types.ObjectId,
    );
    if (!recibo) {
      throw new NotFoundException('Recibo no encontrado');
    }
    return mapReciboToResponse(recibo as unknown as Record<string, unknown>);
  }
}
