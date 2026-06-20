import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CsrfGuard } from '../common/guards/csrf.guard';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { PaymentsService } from './payments.service';
import { Types } from 'mongoose';
import { mapPaymentToResponse } from '../common/utils/serialize-mongoose.util';
import { validateEstado, sanitizeBanco, sanitizeComprobante } from '../common/utils/security.util';
import { validateFileMimeType, validateFileSize } from '../common/utils/file-validation.util';
import { BuildingDocument } from '../buildings/schemas/building.schema';


type RequestWithBuilding = { building: BuildingDocument };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(CsrfGuard, BuildingContextGuard)
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async create(
    @Req() req: RequestWithBuilding,
    @UploadedFile() file: Express.Multer.File,
    @Body('piso') piso: string,
    @Body('apartamento') apartamento: string,
    @Body('meses') mesesRaw: string,
    @Body('banco') banco: string,
    @Body('fechaPago') fechaPago: string,
    @Body('numeroComprobante') numeroComprobante: string,
    @Body('montoUsd') montoUsd: string,
    @Body('montoBs') montoBs?: string,
    @Body('tasaBcv') tasaBcv?: string,
    @Body('recibosIds') recibosIdsRaw?: string,
  ) {
    if (!file) throw new BadRequestException('Se requiere el comprobante');
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    validateFileSize(file.buffer, MAX_SIZE_BYTES);
    const validatedMimeType = validateFileMimeType(file.buffer, file.mimetype);
    const p = parseInt(piso ?? '', 10);
    const a = parseInt(apartamento ?? '', 10);
    if (Number.isNaN(p) || Number.isNaN(a))
      throw new BadRequestException('piso y apartamento inválidos');
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
    if (Number.isNaN(monto) || monto <= 0) throw new BadRequestException('montoUsd inválido');
    if (!fechaPago?.trim()) throw new BadRequestException('fechaPago requerido');
    const bancoSanitizado = sanitizeBanco(banco);
    const numeroComprobanteSanitizado = sanitizeComprobante(numeroComprobante);
    const montoBsNum =
      montoBs != null && montoBs !== '' ? parseFloat(montoBs) : undefined;
    if (montoBsNum !== undefined && (Number.isNaN(montoBsNum) || montoBsNum < 0)) {
      throw new BadRequestException('montoBs inválido');
    }
    const tasaBcvNum =
      tasaBcv != null && tasaBcv !== '' ? parseFloat(tasaBcv) : undefined;
    if (tasaBcvNum !== undefined && (Number.isNaN(tasaBcvNum) || tasaBcvNum < 0)) {
      throw new BadRequestException('tasaBcv inválida');
    }
    let recibosIds: string[] | undefined;
    if (recibosIdsRaw) {
      try {
        const parsed = JSON.parse(recibosIdsRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          recibosIds = parsed.filter((id: unknown) => typeof id === 'string' && Types.ObjectId.isValid(id));
          if (recibosIds.length === 0) {
            recibosIds = undefined;
          }
        }
      } catch {
        recibosIds = undefined;
      }
    }
    const payment = await this.paymentsService.create({
      buildingId: req.building._id as Types.ObjectId,
      piso: p,
      apartamento: a,
      meses,
      banco: bancoSanitizado,
      fechaPago: fechaPago.trim(),
      numeroComprobante: numeroComprobanteSanitizado,
      montoUsd: monto,
      montoBs: montoBsNum,
      tasaBcv: tasaBcvNum,
      comprobanteBuffer: file.buffer,
      comprobanteFilename: file.originalname,
      comprobanteMimetype: validatedMimeType,
      recibosIds,
    });
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
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
    const allowedEstados = ['pendiente', 'aceptado', 'rechazado'];
    const estadoValidado = validateEstado(estado, allowedEstados);
    const list = await this.paymentsService.findAll({
      buildingId: req.building._id as Types.ObjectId,
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estadoValidado,
    });
    return list.map((x) => mapPaymentToResponse(x as unknown as Record<string, unknown>));
  }

  // Endpoint público para residentes — requiere piso y apartamento obligatorios
  @Get('public/por-apartamento')
  @UseGuards(BuildingContextGuard)
  async findPublicByApartamento(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p = parseInt(piso ?? '', 10);
    const a = parseInt(apartamento ?? '', 10);
    if (Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento son requeridos');
    }
    const list = await this.paymentsService.findAll({
      buildingId: req.building._id as Types.ObjectId,
      piso: p,
      apartamento: a,
    });
    return list.map((x) => mapPaymentToResponse(x as unknown as Record<string, unknown>));
  }

  @Patch(':id/aceptar')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async aceptar(@Param('id') id: string, @Req() req: RequestWithBuilding) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const payment = await this.paymentsService.updateEstado(
      id,
      'aceptado',
      req.building._id as Types.ObjectId,
    );
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
  }

  @Patch(':id/rechazar')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async rechazar(@Param('id') id: string, @Req() req: RequestWithBuilding) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const payment = await this.paymentsService.updateEstado(
      id,
      'rechazado',
      req.building._id as Types.ObjectId,
    );
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
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
    const payment = await this.paymentsService.findById(
      id,
      req.building._id as Types.ObjectId,
    );
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
  }
}

