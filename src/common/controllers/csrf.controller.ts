import { Controller, Get, Req, Res } from '@nestjs/common';
import * as express from 'express';
import csurf from 'csurf';

/**
 * Controlador para manejar tokens CSRF
 * Proporciona un endpoint para obtener el token CSRF necesario para requests POST
 */
@Controller('csrf')
export class CsrfController {
  private csrfProtection = csurf({ cookie: true });

  @Get('token')
  getCsrfToken(@Req() req: express.Request, @Res() res: express.Response): void {
    // Generar token CSRF y enviarlo en la cookie
    this.csrfProtection(req, res, () => {
      const token = req.csrfToken();
      res.json({ csrfToken: token });
    });
  }
}
