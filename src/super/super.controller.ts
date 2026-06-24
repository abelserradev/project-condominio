import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../common/guards/super-admin.guard';
import { SuperService } from './super.service';
import { CreateBuildingDto } from './dto/create-building.dto';
import { RenovarSuscripcionDto } from './dto/renovar-suscripcion.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';

type AuthRequest = {
  user: { sub: string; usuario?: string; isSuperAdmin?: boolean };
};

// Rutas globales — sin BuildingContextGuard; el tenant no aplica aquí
@Controller('super')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperController {
  constructor(private readonly superService: SuperService) {}

  @Get('buildings')
  async listarEdificios() {
    return this.superService.listarEdificios();
  }

  @Get('buildings/:id')
  async obtenerEdificio(@Param('id') id: string) {
    return this.superService.obtenerEdificio(id);
  }

  @Post('buildings')
  async crearEdificio(@Body() dto: CreateBuildingDto) {
    return this.superService.crearEdificio(dto);
  }

  @Patch('buildings/:id/renovar')
  async renovarSuscripcion(
    @Param('id') id: string,
    @Body() dto: RenovarSuscripcionDto,
    @Req() req: AuthRequest,
  ) {
    const renovadoPor = req.user.usuario ?? req.user.sub;
    return this.superService.renovarSuscripcion(
      id,
      dto.diasAgregados,
      dto.nota,
      renovadoPor,
    );
  }

  @Patch('buildings/:id/suspender')
  async suspenderEdificio(@Param('id') id: string) {
    return this.superService.suspenderEdificio(id);
  }

  @Patch('buildings/:id/datos-pago')
  async actualizarDatosPago(
    @Param('id') id: string,
    @Body() body: { datosContactoPago: string },
  ) {
    return this.superService.actualizarDatosPago(
      id,
      body.datosContactoPago ?? '',
    );
  }

  @Get('buildings/:id/admin')
  async obtenerAdminEdificio(@Param('id') id: string) {
    return this.superService.obtenerAdminEdificio(id);
  }

  @Patch('buildings/:id/reset-admin')
  async resetAdminPassword(
    @Param('id') id: string,
    @Body() dto: ResetAdminPasswordDto,
  ) {
    return this.superService.resetAdminPassword(id, dto.nuevaPassword);
  }

  @Post('buildings/:id/portal-banner')
  @UseInterceptors(
    FileInterceptor('banner', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async subirPortalBanner(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.superService.subirPortalBanner(id, file);
  }

  @Patch('buildings/:id/portal-banner/eliminar')
  async eliminarPortalBanner(@Param('id') id: string) {
    return this.superService.eliminarPortalBanner(id);
  }
}
