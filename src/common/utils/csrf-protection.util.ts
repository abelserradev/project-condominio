import csurf from 'csurf';
import type { RequestHandler } from 'express';

const esProduccion = process.env.NODE_ENV === 'production';

// secure=true en prod (HTTPS); en dev local HTTP la cookie no se enviaría con secure
const opcionesCookieCsrf = {
  httpOnly: true,
  secure: esProduccion,
  sameSite: 'lax' as const,
};

export function crearProteccionCsrf(): RequestHandler {
  return csurf({ cookie: opcionesCookieCsrf });
}
