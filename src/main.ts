import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  // Helmet para headers de seguridad HTTP - configuración más permisiva para desarrollo
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Desactivado para evitar conflictos en desarrollo
  }));

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

  // CORS configurado - más permisivo en desarrollo
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  const allowedOrigins = frontendUrl.split(',').map((url) => url.trim());
  
  app.enableCors({
    origin: (origin, callback) => {
      // En desarrollo, permitir localhost sin origin (peticiones directas)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Permitir origins configurados
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // En desarrollo, también permitir localhost con diferentes puertos
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
        return;
      }
      console.warn(`[CORS] Origin no permitido: ${origin}`);
      callback(new Error('No permitido por CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
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
