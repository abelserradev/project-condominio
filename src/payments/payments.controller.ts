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
import { validateEstado } from '../common/utils/security.util';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import { buildCreatePaymentFromForm } from './utils/parse-create-payment-form.util';

type RequestWithBuilding = { building: BuildingDocument };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(CsrfGuard, BuildingContextGuard, SubscriptionGuard)
  @UseInterceptors(
    FileInterceptor('comprobante', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async create(
    @Req() req: RequestWithBuilding,
    @UploadedFile() file: Express.Multer.File,
    @Body() rawBody: Record<string, unknown>,
  ) {
    const parsed = buildCreatePaymentFromForm(file, rawBody);
    const payment = await this.paymentsService.create({
      buildingId: req.building._id,
      ...parsed,
    });
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
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
    const allowedEstados = ['pendiente', 'aceptado', 'rechazado'];
    const estadoValidado = validateEstado(estado, allowedEstados);
    const list = await this.paymentsService.findAll({
      buildingId: req.building._id,
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estadoValidado,
    });
    return list.map((x) =>
      mapPaymentToResponse(x as unknown as Record<string, unknown>),
    );
  }

  // Endpoint público para residentes — requiere piso y apartamento obligatorios
  @Get('public/por-apartamento')
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async findPublicByApartamento(
    @Req() req: RequestWithBuilding,
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
  ) {
    const p = Number.parseInt(piso ?? '', 10);
    const a = Number.parseInt(apartamento ?? '', 10);
    if (Number.isNaN(p) || Number.isNaN(a)) {
      throw new BadRequestException('piso y apartamento son requeridos');
    }
    const list = await this.paymentsService.findAll({
      buildingId: req.building._id,
      piso: p,
      apartamento: a,
    });
    return list.map((x) =>
      mapPaymentToResponse(x as unknown as Record<string, unknown>),
    );
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
      req.building._id,
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
      req.building._id,
    );
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
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
    const payment = await this.paymentsService.findById(id, req.building._id);
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    return mapPaymentToResponse(payment as unknown as Record<string, unknown>);
  }
}
