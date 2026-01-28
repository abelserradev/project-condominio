import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    try {
      const status =
        exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

      const message =
        exception instanceof HttpException
          ? exception.getResponse()
          : 'Error interno del servidor';

      const isDevelopment = process.env.NODE_ENV === 'development';

      const errorResponse = {
        statusCode: status,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        message: typeof message === 'string' ? message : (message as { message?: string }).message || 'Error desconocido',
        ...(isDevelopment && {
          stack: exception instanceof Error ? exception.stack : undefined,
          error: exception instanceof Error ? exception.message : String(exception),
        }),
      };

      if (status >= 500) {
        this.logger.error(
          `${request.method} ${request.url} - ${status}`,
          exception instanceof Error ? exception.stack : String(exception),
        );
      } else {
        this.logger.warn(
          `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
        );
      }

      if (!response.headersSent) {
        response.status(status).json(errorResponse);
      }
    } catch (error) {
      this.logger.error('Error en el filtro de excepciones:', error);
      if (!response.headersSent) {
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Error interno del servidor',
        });
      }
    }
  }
}
