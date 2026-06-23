import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

const isDevelopment = process.env.NODE_ENV === 'development';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  // Cookie parser necesario para CSRF
  app.use(cookieParser());

  // Helmet para headers de seguridad HTTP
  const helmetConfig: Parameters<typeof helmet>[0] = {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: isDevelopment
      ? false // En desarrollo desactivar para facilitar debugging
      : {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            fontSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: [],
          },
        },
  };
  app.use(helmet(helmetConfig));

  // Filtro global de excepciones
  app.useGlobalFilters(new AllExceptionsFilter());

  // Validación global con class-validator
  // Nota: forbidNonWhitelisted deshabilitado para permitir FormData y archivos
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
    }),
  );

  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const allowedOrigins = new Set(
    frontendUrl
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean),
  );

  if (!isDevelopment) {
    const primerOrigen = Array.from(allowedOrigins)[0];
    if (primerOrigen) {
      try {
        const host = new URL(primerOrigen).hostname;
        if (!host.includes('.') || /^[0-9a-f]{8,}$/i.test(host)) {
          console.warn(
            `[App] FRONTEND_URL="${primerOrigen}" parece URL interna de Docker. ` +
              'En Coolify usa https://buildforge.work y PLATFORM_ROOT_DOMAIN=buildforge.work',
          );
        }
      } catch {
        // ignorar URL mal formada
      }
    }
    if (!process.env.PLATFORM_ROOT_DOMAIN?.trim()) {
      console.warn(
        '[App] PLATFORM_ROOT_DOMAIN no definido — los portales de edificios pueden generar URLs incorrectas',
      );
    }
  }

  const isPrivateNetworkOrigin = (o: string) => {
    try {
      const u = new URL(o);
      const host = u.hostname;
      return (
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.startsWith('172.16.') ||
        host.startsWith('172.17.') ||
        host === 'localhost' ||
        host === '127.0.0.1'
      );
    } catch {
      return false;
    }
  };

  /** Permite subdominios tenant (ej. torre-norte.buildforge.work) si el origen raíz está en FRONTEND_URL */
  const esSubdominioPermitido = (origin: string): boolean => {
    try {
      const originHost = new URL(origin).hostname;
      for (const allowed of allowedOrigins) {
        const baseHost = new URL(allowed).hostname;
        if (originHost === baseHost) return true;
        if (originHost.endsWith(`.${baseHost}`)) return true;
      }
    } catch {
      return false;
    }
    return false;
  };

  const validarOrigenCors = (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ): void => {
    // Peticiones sin Origin: favicon, health checks, curl, acceso directo
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    if (esSubdominioPermitido(origin)) {
      callback(null, true);
      return;
    }

    if (
      isDevelopment &&
      (origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:'))
    ) {
      callback(null, true);
      return;
    }

    if (isDevelopment && isPrivateNetworkOrigin(origin)) {
      callback(null, true);
      return;
    }

    // No hay fallback permisivo — cualquier origen no reconocido queda bloqueado
    // incluso en desarrollo, para evitar que NODE_ENV=development en prod abra el CORS
    callback(new Error('No permitido por CORS'));
  };

  app.enableCors({
    origin: validarOrigenCors,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-CSRF-Token',
      'x-building-slug',
    ],
    exposedHeaders: ['Authorization'],
  });

  const port = process.env.PORT ?? 3001;
  try {
    await app.listen(port, '0.0.0.0'); // Escuchar en todas las interfaces
    console.log(`[App] Servidor iniciado en puerto ${port}`);
  } catch (error) {
    console.error('[App] Error al iniciar servidor:', error);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('[App] Error fatal al iniciar aplicación:', error);
  process.exit(1);
});
