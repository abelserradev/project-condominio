import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { AvisosService } from './avisos.service';
import { CreateAvisoDto } from './dto/create-aviso.dto';
import { UpdateAvisoDto } from './dto/update-aviso.dto';
import { BuildingDocument } from '../buildings/schemas/building.schema';

type RequestWithBuilding = { building: BuildingDocument };

function mapDocToResponse(
  doc: {
    _id: { toString(): string };
    titulo: string;
    mensaje: string;
    tipo: string;
    prioridad?: string;
    estado?: string;
  } & { createdAt?: Date },
) {
  const createdAt = doc.createdAt;
  return {
    _id: doc._id.toString(),
    titulo: doc.titulo,
    mensaje: doc.mensaje,
    tipo: doc.tipo,
    prioridad: doc.prioridad ?? 'media',
    estado: doc.estado ?? 'borrador',
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
  };
}

@Controller('avisos')
export class AvisosController {
  constructor(private readonly avisosService: AvisosService) {}

  @Get()
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async findAll(@Req() req: RequestWithBuilding) {
    const buildingId = req.building._id;
    const list = await this.avisosService.findAll(buildingId);
    return list.map((item) =>
      mapDocToResponse(item as Parameters<typeof mapDocToResponse>[0]),
    );
  }

  @Get('unread-count')
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async getUnreadCount(
    @Req() req: RequestWithBuilding,
    @Query('deviceId') deviceId: string | undefined,
  ) {
    const buildingId = req.building._id;
    const count = await this.avisosService.getUnreadCount(
      deviceId ?? null,
      buildingId,
    );
    return { count };
  }

  @Post('mark-read')
  async markAsRead(@Body('deviceId') deviceId: string) {
    if (!deviceId) {
      return { ok: true };
    }
    await this.avisosService.markAsRead(deviceId);
    return { ok: true };
  }

  @Get(':id')
  @UseGuards(BuildingContextGuard, SubscriptionGuard)
  async findOne(@Req() req: RequestWithBuilding, @Param('id') id: string) {
    const buildingId = req.building._id;
    const doc = await this.avisosService.findOne(id, buildingId);
    if (!doc) throw new NotFoundException('Aviso no encontrado');
    return mapDocToResponse(doc);
  }

  @Post()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async create(@Req() req: RequestWithBuilding, @Body() dto: CreateAvisoDto) {
    const buildingId = req.building._id;
    const doc = await this.avisosService.create(dto, buildingId);
    return mapDocToResponse(doc);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async update(
    @Req() req: RequestWithBuilding,
    @Param('id') id: string,
    @Body() dto: UpdateAvisoDto,
  ) {
    const buildingId = req.building._id;
    const doc = await this.avisosService.update(id, dto, buildingId);
    if (!doc) throw new NotFoundException('Aviso no encontrado');
    return mapDocToResponse(doc);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async remove(@Req() req: RequestWithBuilding, @Param('id') id: string) {
    const buildingId = req.building._id;
    await this.avisosService.remove(id, buildingId);
    return { ok: true };
  }
}
