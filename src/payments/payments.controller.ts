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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import { Types } from 'mongoose';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {
    console.log('[PaymentsController] Controlador inicializado');
  }

  @Post()
  @UseInterceptors(FileInterceptor('comprobante'))
  async create(
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
  ) {
    if (!file) throw new BadRequestException('Se requiere el comprobante');
    const p = parseInt(piso ?? '', 10);
    const a = parseInt(apartamento ?? '', 10);
    if (Number.isNaN(p) || Number.isNaN(a))
      throw new BadRequestException('piso y apartamento inválidos');
    let meses: number[];
    try {
      meses = JSON.parse(mesesRaw ?? '[]') as number[];
    } catch {
      throw new BadRequestException('meses inválido');
    }
    if (!Array.isArray(meses) || meses.length === 0)
      throw new BadRequestException('Se requiere al menos un mes');
    const monto = parseFloat(montoUsd ?? '');
    if (Number.isNaN(monto)) throw new BadRequestException('montoUsd inválido');
    if (!banco?.trim() || !fechaPago?.trim() || !numeroComprobante?.trim())
      throw new BadRequestException('banco, fechaPago y numeroComprobante requeridos');

    const montoBsNum =
      montoBs != null && montoBs !== '' ? parseFloat(montoBs) : undefined;
    const tasaBcvNum =
      tasaBcv != null && tasaBcv !== '' ? parseFloat(tasaBcv) : undefined;

    const payment = await this.paymentsService.create({
      piso: p,
      apartamento: a,
      meses,
      banco: banco.trim(),
      fechaPago: fechaPago.trim(),
      numeroComprobante: numeroComprobante.trim(),
      montoUsd: monto,
      montoBs: montoBsNum,
      tasaBcv: tasaBcvNum,
      comprobanteBuffer: file.buffer,
      comprobanteFilename: file.originalname,
      comprobanteMimetype: file.mimetype,
    });
    const out = payment as unknown as Record<string, unknown>;
    const fid = out.comprobanteFileId as { toString?: () => string } | undefined;
    return {
      ...out,
      comprobanteFileId: fid?.toString?.() ?? null,
    };
  }

  @Get()
  async findAll(
    @Query('piso') piso: string,
    @Query('apartamento') apartamento: string,
    @Query('estado') estado: string,
  ) {
    console.log('[PaymentsController] GET /payments con query:', {
      piso,
      apartamento,
      estado,
    });
    const p =
      piso != null && piso !== '' ? parseInt(piso, 10) : undefined;
    const a =
      apartamento != null && apartamento !== ''
        ? parseInt(apartamento, 10)
        : undefined;
    const list = await this.paymentsService.findAll({
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estado != null && estado !== '' ? estado : undefined,
    });
    console.log(`[PaymentsController] GET /payments retornando ${list.length} pagos`);
    return list.map((x) => {
      const row = x as unknown as Record<string, unknown>;
      const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
      return {
        ...row,
        comprobanteFileId: fid?.toString?.() ?? null,
      };
    });
  }

  // IMPORTANTE: Las rutas específicas deben ir ANTES de la genérica :id
  @Patch(':id/aceptar')
  async aceptar(@Param('id') id: string) {
    console.log('[PaymentsController] PATCH /payments/:id/aceptar llamado con id:', id);
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    try {
      const payment = await this.paymentsService.updateEstado(id, 'aceptado');
      console.log('[PaymentsController] PATCH /payments/:id/aceptar - pago aceptado exitosamente');
      const row = payment as unknown as Record<string, unknown>;
      const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
      return {
        ...row,
        comprobanteFileId: fid?.toString?.() ?? null,
      };
    } catch (err) {
      console.error('[PaymentsController] PATCH /payments/:id/aceptar error:', err);
      throw err;
    }
  }

  @Patch(':id/rechazar')
  async rechazar(@Param('id') id: string) {
    console.log('[PaymentsController] PATCH /payments/:id/rechazar llamado con id:', id);
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    try {
      const payment = await this.paymentsService.updateEstado(id, 'rechazado');
      console.log('[PaymentsController] PATCH /payments/:id/rechazar - pago rechazado exitosamente');
      const row = payment as unknown as Record<string, unknown>;
      const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
      return {
        ...row,
        comprobanteFileId: fid?.toString?.() ?? null,
      };
    } catch (err) {
      console.error('[PaymentsController] PATCH /payments/:id/rechazar error:', err);
      throw err;
    }
  }

  // La ruta genérica :id debe ir AL FINAL
  @Get(':id')
  async findOne(@Param('id') id: string) {
    console.log('[PaymentsController] GET /payments/:id - INICIO');
    console.log('[PaymentsController] GET /payments/:id - id recibido:', id);
    console.log('[PaymentsController] GET /payments/:id - tipo de id:', typeof id);
    console.log('[PaymentsController] GET /payments/:id - longitud de id:', id?.length);
    
    if (!id || id.trim() === '') {
      console.log('[PaymentsController] GET /payments/:id - ERROR: id vacío');
      throw new BadRequestException('ID requerido');
    }

    if (!Types.ObjectId.isValid(id)) {
      console.log('[PaymentsController] GET /payments/:id - ERROR: id no es un ObjectId válido');
      throw new BadRequestException('ID inválido');
    }

    try {
      console.log('[PaymentsController] GET /payments/:id - llamando a findById');
      const payment = await this.paymentsService.findById(id);
      if (!payment) {
        console.log('[PaymentsController] GET /payments/:id - pago no encontrado en BD');
        throw new NotFoundException('Pago no encontrado');
      }
      console.log('[PaymentsController] GET /payments/:id - pago encontrado exitosamente');
      const row = payment as unknown as Record<string, unknown>;
      const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
      const result = {
        ...row,
        comprobanteFileId: fid?.toString?.() ?? null,
      } as Record<string, unknown>;
      console.log('[PaymentsController] GET /payments/:id - retornando resultado:', {
        _id: result._id,
        piso: result.piso,
        apartamento: result.apartamento,
        tieneComprobante: !!result.comprobanteFileId,
      });
      return result;
    } catch (err) {
      console.error('[PaymentsController] GET /payments/:id - ERROR CAPTURADO:', err);
      console.error('[PaymentsController] GET /payments/:id - tipo de error:', err?.constructor?.name);
      console.error('[PaymentsController] GET /payments/:id - mensaje:', (err as Error)?.message);
      if (err instanceof NotFoundException || err instanceof BadRequestException) {
        throw err;
      }
      throw new NotFoundException('Error al buscar pago');
    }
  }
}