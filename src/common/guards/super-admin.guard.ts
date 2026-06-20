import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../../user/user.service';
import { RequestWithJwtUser } from '../types/http-request.types';

/**
 * El JWT puede decir isSuperAdmin, pero la fuente de verdad es la BD en cada request.
 * Así un token robado de un admin de edificio no sirve aunque alguien manipule claims sin BD.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithJwtUser>();
    const tokenUser = req.user;

    if (!tokenUser?.sub) {
      throw new ForbiddenException(
        'Acceso restringido a administradores de la plataforma',
      );
    }

    const dbUser = await this.userService.findById(tokenUser.sub);
    if (!dbUser?.isSuperAdmin) {
      throw new ForbiddenException(
        'Acceso restringido a administradores de la plataforma',
      );
    }

    req.user.isSuperAdmin = true;
    req.user.rol = 'superadmin';
    return true;
  }
}
