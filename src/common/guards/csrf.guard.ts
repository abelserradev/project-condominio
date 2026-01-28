import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import * as csurf from 'csurf';

/**
 * Guard para protección CSRF
 * En desarrollo puede ser deshabilitado mediante variable de entorno
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private csrfProtection = csurf({ cookie: true });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // En desarrollo, permitir deshabilitar CSRF para facilitar testing
    if (process.env.DISABLE_CSRF === 'true') {
      return true;
    }

    return new Promise((resolve, reject) => {
      this.csrfProtection(request, response, (err) => {
        if (err) {
          reject(new ForbiddenException('Token CSRF inválido o faltante'));
        } else {
          resolve(true);
        }
      });
    });
  }
}
