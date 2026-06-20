import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const result = super.canActivate(context);
    if (result instanceof Promise) {
      return result.catch(() => {
        throw new UnauthorizedException(
          'Token de autenticación inválido o expirado',
        );
      });
    }
    return result;
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any,
  ): TUser {
    if (err || !user) {
      throw (
        err ??
        new UnauthorizedException('Token de autenticación inválido o expirado')
      );
    }
    return super.handleRequest(err, user, info, context, status);
  }
}
