import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import csurf from 'csurf';

/**
 * Guard para protección CSRF
 * En desarrollo puede ser deshabilitado mediante variable de entorno
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private csrfProtection = csurf({ cookie: true });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    if (process.env.DISABLE_CSRF === 'true') {
      this.logger.log(`[DEBUG] CSRF deshabilitado por DISABLE_CSRF=true`);
      return true;
    }

    return new Promise((resolve, reject) => {
      this.csrfProtection(request, response, (err) => {
        if (err) {
          this.logger.log(`[DEBUG] CSRF rechazado: ${err?.message ?? String(err)}. Header X-CSRF-Token presente: ${!!request.headers['x-csrf-token']}`);
          reject(new ForbiddenException('Token CSRF inválido o faltante'));
        } else {
          this.logger.log(`[DEBUG] CSRF OK`);
          resolve(true);
        }
      });
    });
  }
}
