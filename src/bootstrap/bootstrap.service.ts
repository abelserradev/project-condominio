import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { UserService } from '../user/user.service';

/**
 * Crea el SuperAdmin de plataforma al arrancar, si se activa desde el entorno.
 *
 * Variables requeridas para que actúe:
 *   SUPERADMIN_AUTO_BOOTSTRAP=true
 *   SUPERADMIN_USUARIO=<usuario>
 *   SUPERADMIN_PASSWORD=<clave>
 *
 * Una vez creado el SA, quita SUPERADMIN_AUTO_BOOTSTRAP y SUPERADMIN_PASSWORD
 * de Coolify para no dejar credenciales en el entorno de forma permanente.
 */
@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly userService: UserService) {}

  async onModuleInit(): Promise<void> {
    const autoBootstrap = process.env.SUPERADMIN_AUTO_BOOTSTRAP?.trim();
    if (autoBootstrap !== 'true') return;

    const usuario = process.env.SUPERADMIN_USUARIO?.trim();
    const password = process.env.SUPERADMIN_PASSWORD?.trim();

    if (!usuario || !password) {
      this.logger.warn(
        'SUPERADMIN_AUTO_BOOTSTRAP=true pero faltan SUPERADMIN_USUARIO o SUPERADMIN_PASSWORD. Omitiendo bootstrap.',
      );
      return;
    }

    // Solo actuamos si no existe ningún superadmin en la BD para evitar
    // sobrescribir credenciales en cada redeploy accidental
    const yaExiste = await this.userService.existeSuperAdmin();
    if (yaExiste) {
      const actual = await this.userService.findPrimerSuperAdmin();
      this.logger.log(
        `SuperAdmin ya existe en BD (usuario: "${actual?.usuario ?? 'desconocido'}") — bootstrap omitido. Puedes quitar SUPERADMIN_AUTO_BOOTSTRAP de Coolify.`,
      );
      return;
    }

    await this.userService.ensureSuperAdmin(usuario, password);
    this.logger.log(
      `✅ SuperAdmin "${usuario}" creado. Quita SUPERADMIN_AUTO_BOOTSTRAP y SUPERADMIN_PASSWORD de las variables de entorno.`,
    );
  }
}
