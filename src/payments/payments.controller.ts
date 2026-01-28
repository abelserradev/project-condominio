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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { Types } from 'mongoose';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: 5 * 1024 * 1024 } }))
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
    @Body('recibosIds') recibosIdsRaw?: string,
  ) {
    if (!file) throw new BadRequestException('Se requiere el comprobante');
    const MAX_SIZE_MB = 5;
    const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`El archivo excede el tamaño máximo de ${MAX_SIZE_MB}MB`);
    }
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

    let recibosIds: string[] | undefined;
    if (recibosIdsRaw) {
      try {
        recibosIds = JSON.parse(recibosIdsRaw) as string[];
        if (!Array.isArray(recibosIds) || recibosIds.length === 0) {
          recibosIds = undefined;
        }
      } catch {
        recibosIds = undefined;
      }
    }

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
      recibosIds,
    });
    const out = payment as unknown as Record<string, unknown>;
    const fid = out.comprobanteFileId as { toString?: () => string } | undefined;
    const recibosPagados = out.recibosPagados as unknown[] | undefined;
    return {
      ...out,
      comprobanteFileId: fid?.toString?.() ?? null,
      recibosPagados: recibosPagados?.map((id) => {
        const objId = id as { toString?: () => string };
        return objId?.toString?.() ?? String(id);
      }) ?? [],
    };
  }

  @Get()
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
    const list = await this.paymentsService.findAll({
      piso: p != null && !Number.isNaN(p) ? p : undefined,
      apartamento: a != null && !Number.isNaN(a) ? a : undefined,
      estado: estado != null && estado !== '' ? estado : undefined,
    });
    return list.map((x) => {
      const row = x as unknown as Record<string, unknown>;
      const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
      const recibosPagados = row.recibosPagados as unknown[] | undefined;
      return {
        ...row,
        comprobanteFileId: fid?.toString?.() ?? null,
        recibosPagados: recibosPagados?.map((id) => {
          const objId = id as { toString?: () => string };
          return objId?.toString?.() ?? String(id);
        }) ?? [],
      };
    });
  }

  // IMPORTANTE: Las rutas específicas deben ir ANTES de la genérica :id
  @Patch(':id/aceptar')
  @UseGuards(JwtAuthGuard)
  async aceptar(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const payment = await this.paymentsService.updateEstado(id, 'aceptado');
    const row = payment as unknown as Record<string, unknown>;
    const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
    const recibosPagados = row.recibosPagados as unknown[] | undefined;
    return {
      ...row,
      comprobanteFileId: fid?.toString?.() ?? null,
      recibosPagados: recibosPagados?.map((id) => {
        const objId = id as { toString?: () => string };
        return objId?.toString?.() ?? String(id);
      }) ?? [],
    };
  }

  @Patch(':id/rechazar')
  @UseGuards(JwtAuthGuard)
  async rechazar(@Param('id') id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const payment = await this.paymentsService.updateEstado(id, 'rechazado');
    const row = payment as unknown as Record<string, unknown>;
    const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
    const recibosPagados = row.recibosPagados as unknown[] | undefined;
    return {
      ...row,
      comprobanteFileId: fid?.toString?.() ?? null,
      recibosPagados: recibosPagados?.map((id) => {
        const objId = id as { toString?: () => string };
        return objId?.toString?.() ?? String(id);
      }) ?? [],
    };
  }

  // La ruta genérica :id debe ir AL FINAL
  @Get(':id')
  async findOne(@Param('id') id: string) {
    if (!id || id.trim() === '') {
      throw new BadRequestException('ID requerido');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID inválido');
    }
    const payment = await this.paymentsService.findById(id);
    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }
    const row = payment as unknown as Record<string, unknown>;
    const fid = row.comprobanteFileId as { toString?: () => string } | undefined;
    const recibosPagados = row.recibosPagados as unknown[] | undefined;
    return {
      ...row,
      comprobanteFileId: fid?.toString?.() ?? null,
      recibosPagados: recibosPagados?.map((id) => {
        const objId = id as { toString?: () => string };
        return objId?.toString?.() ?? String(id);
      }) ?? [],
    };
  }
}