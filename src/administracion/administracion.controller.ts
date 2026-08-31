import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  UseGuards,
  Req,
  GoneException,
} from '@nestjs/common';
import * as express from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { AdministracionService } from './administracion.service';
import { AbonoApartamentoService } from './abono-apartamento.service';
import {
  CobranzaReportService,
  type FiltroCobranza,
} from './cobranza-report.service';
import { CobranzaSnapshotService } from './cobranza-snapshot.service';
import { CobranzaExcelJobFacade } from './cobranza-excel-job.facade';
import { Types } from 'mongoose';
import { mapReciboToResponse } from '../common/utils/serialize-mongoose.util';
import {
  validateEstado,
  sanitizeTipoDeuda,
} from '../common/utils/security.util';
import {
  validateFileMimeType,
  validateFileSize,
} from '../common/utils/file-validation.util';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import {
  parseCreateReciboFormBody,
  type CreateReciboFormFields,
} from './utils/parse-create-recibo-form.util';

type RequestWithBuilding = { building: BuildingDocument };

type UserFromJwt = {
  sub: string;
  usuario?: string;
  rol: string;
  buildingId?: string;
};

type RequestWithBuildingAndUser = RequestWithBuilding & { user: UserFromJwt };

@Controller('administracion')
export class AdministracionController {
  constructor(
    private readonly administracionService: AdministracionService,
    private readonly abonoApartamentoService: AbonoApartamentoService,
    private readonly cobranzaReportService: CobranzaReportService,
    private readonly cobranzaSnapshotService: CobranzaSnapshotService,
    private readonly cobranzaExcelJobFacade: CobranzaExcelJobFacade,
  ) {}

  @Get('public/abono')
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async getAbonoPublico(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p =
      piso != null && piso !== '' ? Number.parseInt(piso, 10) : undefined;
    const a =
      apartamento != null && apartamento !== ''
        ? Number.parseInt(apartamento, 10)
        : undefined;
    if (p == null || a == null || Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento requeridos');
    }
    const monto = await this.abonoApartamentoService.getMonto(
      p,
      a,
      req.building._id,
    );
    return { monto };
  }

  @Get('public/pendientes')
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async getRecibosPendientes(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p =
      piso != null && piso !== '' ? Number.parseInt(piso, 10) : undefined;
    const a =
      apartamento != null && apartamento !== ''
        ? Number.parseInt(apartamento, 10)
        : undefined;
    if (p == null || a == null || Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento requeridos');
    }
    const recibos = await this.administracionService.findPendientesByApto(
      p,
      a,
      req.building._id,
    );
    return recibos.map((x) =>
      mapReciboToResponse(x as unknown as Record<string, unknown>),
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async create(
    @Req() req: RequestWithBuilding,
    @Body() body: CreateReciboFormFields,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dto = parseCreateReciboFormBody(body);
    const tipoDeuda = sanitizeTipoDeuda(dto.tipoDeuda);

    let fileId: string | undefined;
    if (file) {
      validateFileSize(file.buffer, 5 * 1024 * 1024);
      const mimetype = validateFileMimeType(file.buffer, file.mimetype);
      fileId = await this.administracionService.uploadFacturaFile(
        file.buffer,
        file.originalname,
        mimetype,
      );
    }

    const recibo = await this.administracionService.createReciboFromForm({
      piso: Number.parseInt(dto.piso, 10),
      apartamento: Number.parseInt(dto.apartamento, 10),
      meses: dto.meses
        .split(',')
        .map((m) => Number.parseInt(m.trim(), 10))
        .filter((m) => !Number.isNaN(m)),
      montoUsd: Number.parseFloat(dto.montoUsd),
      tipoDeuda,
      fechaReportada: dto.fechaReportada,
      buildingId: req.building._id,
      facturaFileId: fileId,
    });

    this.cobranzaSnapshotService.programarRebuild(req.building._id);

    return mapReciboToResponse(recibo as unknown as Record<string, unknown>);
  }

  @Get()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async findAll(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
    @Query('estado') estado: string,
  ) {
    const p =
      piso != null && piso !== '' ? Number.parseInt(piso, 10) : undefined;
    const a =
      apartamento != null && apartamento !== ''
        ? Number.parseInt(apartamento, 10)
        : undefined;
    const allowedEstados = ['pendiente', 'pagado'];
    const estadoValidado = validateEstado(estado, allowedEstados);
    const list = await this.administracionService.findAll({
      buildingId: req.building._id,
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estadoValidado,
    });
    return list.map((x) =>
      mapReciboToResponse(x as unknown as Record<string, unknown>),
    );
  }

  /**
   * Reporte de cobranza del edificio (specs/api/reporte-cobranza-api-v1.md).
   * Debe declararse ANTES de @Get(':id') o Express enruta "reporte" como id.
   */
  @Get('reporte/cobranza')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async reporteCobranza(
    @Req() req: RequestWithBuilding,
    @Res() res: express.Response,
    @Query('format') format?: string,
    @Query('filtro') filtro?: string,
  ): Promise<void> {
    const formatValido = format ?? 'json';
    if (formatValido !== 'json' && formatValido !== 'xlsx') {
      throw new BadRequestException("format debe ser 'json' o 'xlsx'");
    }
    const filtroValido: FiltroCobranza =
      filtro === 'al_dia' || filtro === 'moroso' ? filtro : 'todos';
    if (filtro && filtro !== filtroValido) {
      throw new BadRequestException(
        "filtro debe ser 'todos', 'al_dia' o 'moroso'",
      );
    }

    const reporte = await this.cobranzaSnapshotService.obtenerReporte(
      req.building._id,
    );

    if (formatValido === 'json') {
      const filas =
        filtroValido === 'todos'
          ? reporte.filas
          : reporte.filas.filter((f) => f.categoria === filtroValido);
      res.json({ ...reporte, filas });
      return;
    }

    // Excel síncrono: deprecated. Solo permitido en dev con flag explícito.
    if (process.env.COBRANZA_SYNC_XLSX === 'true') {
      const buffer = await this.cobranzaReportService.buildExcel(
        req.building._id,
        filtroValido,
      );
      const fecha = reporte.generadoEn.slice(0, 10);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reporte-cobranza-${fecha}.xlsx"`,
      );
      res.send(buffer);
      return;
    }

    throw new GoneException(
      'Use POST /administracion/reporte/cobranza/jobs para descargar Excel.',
    );
  }

  /**
   * Encola generación asíncrona de Excel de cobranza (REQ-012).
   * Devuelve 202 con jobId y estado pending.
   */
  @Post('reporte/cobranza/jobs')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async crearExcelJob(
    @Req() req: RequestWithBuilding,
    @Body('filtro') filtro?: string,
  ): Promise<{ jobId: string; estado: 'pending'; creadoEn: string }> {
    const filtroValido: FiltroCobranza =
      filtro === 'al_dia' || filtro === 'moroso' ? filtro : 'todos';
    if (filtro && filtro !== filtroValido) {
      throw new BadRequestException(
        "filtro debe ser 'todos', 'al_dia' o 'moroso'",
      );
    }
    return this.cobranzaExcelJobFacade.crearJob(req.building._id, filtroValido);
  }

  /**
   * Consulta estado de un job de Excel de cobranza (REQ-013).
   */
  @Get('reporte/cobranza/jobs/:jobId')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async estadoExcelJob(
    @Req() req: RequestWithBuildingAndUser,
    @Param('jobId') jobId: string,
  ) {
    return this.cobranzaExcelJobFacade.obtenerEstado(jobId, req.building._id);
  }

  /**
   * Descarga el archivo de un job de Excel listo (REQ-013).
   * Solo accesible para el mismo buildingId del JWT.
   */
  @Get('reporte/cobranza/jobs/:jobId/download')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async downloadExcelJob(
    @Req() req: RequestWithBuildingAndUser,
    @Param('jobId') jobId: string,
    @Res() res: express.Response,
  ): Promise<void> {
    await this.cobranzaExcelJobFacade.descargar(jobId, req.building._id, res);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async findOne(@Param('id') id: string, @Req() req: RequestWithBuilding) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('ID requerido');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const recibo = await this.administracionService.findById(
      id,
      req.building._id,
    );
    if (!recibo) {
      throw new NotFoundException('Recibo no encontrado');
    }
    return mapReciboToResponse(recibo as unknown as Record<string, unknown>);
  }
}
