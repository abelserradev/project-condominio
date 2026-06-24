import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BuildingContextGuard } from '../common/guards/building-context.guard';
import { SubscriptionGuard } from '../common/guards/subscription.guard';
import { BuildingDocument } from '../buildings/schemas/building.schema';
import { OwnersService } from './owners.service';
import { CreateOwnerDto } from './dto/create-owner.dto';
import { UpdateOwnerDto } from './dto/update-owner.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { mapOwnerToResponse } from './utils/owner-response.util';

type AuthBuildingRequest = {
  building: BuildingDocument;
  user: {
    sub: string;
    rol: string;
    buildingId?: string;
  };
};

function assertAdminDelEdificio(req: AuthBuildingRequest): void {
  if (req.user.rol !== 'admin') {
    throw new ForbiddenException(
      'Solo administradores del edificio pueden gestionar propietarios',
    );
  }
  const bid = req.building._id;
  if (req.user.buildingId !== bid.toString()) {
    throw new ForbiddenException('No perteneces a este edificio');
  }
}

function assertPropietario(req: AuthBuildingRequest): void {
  const rol = req.user.rol;
  if (rol !== 'propietario' && rol !== 'inquilino') {
    throw new ForbiddenException('Solo propietarios pueden usar esta acción');
  }
}

@Controller('owners')
export class OwnersController {
  constructor(private readonly ownersService: OwnersService) {}

  @Get()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async findAll(
    @Req() req: AuthBuildingRequest,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    assertAdminDelEdificio(req);
    const buildingId = req.building._id;
    const list = await this.ownersService.findAll(
      buildingId,
      incluirInactivos === 'true',
    );
    return list.map((o) => mapOwnerToResponse(o));
  }

  @Post()
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async create(@Req() req: AuthBuildingRequest, @Body() dto: CreateOwnerDto) {
    assertAdminDelEdificio(req);
    const created = await this.ownersService.create(req.building._id, dto);
    return mapOwnerToResponse(created);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async changeMyPassword(
    @Req() req: AuthBuildingRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    assertPropietario(req);
    await this.ownersService.changePassword(
      req.user.sub,
      req.building._id,
      dto.contraseñaActual,
      dto.contraseñaNueva,
    );
    return { ok: true, message: 'Contraseña actualizada' };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async findOne(@Req() req: AuthBuildingRequest, @Param('id') id: string) {
    assertAdminDelEdificio(req);
    const owner = await this.ownersService.findById(id, req.building._id);
    if (!owner) throw new NotFoundException('Propietario no encontrado');
    return mapOwnerToResponse(owner);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async update(
    @Req() req: AuthBuildingRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOwnerDto,
  ) {
    assertAdminDelEdificio(req);
    const updated = await this.ownersService.update(id, req.building._id, dto);
    return mapOwnerToResponse(updated);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, BuildingContextGuard, SubscriptionGuard)
  async deactivate(@Req() req: AuthBuildingRequest, @Param('id') id: string) {
    assertAdminDelEdificio(req);
    const updated = await this.ownersService.deactivate(id, req.building._id);
    return mapOwnerToResponse(updated);
  }
}
