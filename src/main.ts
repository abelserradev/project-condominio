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

  // CORS configurado con restricciones apropiadas
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const allowedOrigins = frontendUrl.split(',').map((url) => url.trim()).filter(Boolean);
  
  app.enableCors({
    origin: (origin, callback) => {
      // En producción, rechazar requests sin origin
      if (!origin) {
        if (isDevelopment) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin requerido'));
        return;
      }
      
      // Permitir origins configurados explícitamente
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      
      // En desarrollo, permitir localhost con diferentes puertos
      if (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) {
        callback(null, true);
        return;
      }
      
      // En producción, rechazar cualquier otro origin
      if (!isDevelopment) {
        console.warn(`[CORS] Origin no permitido: ${origin}`);
        callback(new Error('No permitido por CORS'));
        return;
      }
      
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With', 'X-CSRF-Token'],
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
