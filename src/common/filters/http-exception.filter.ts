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
      const status = this.resolveStatus(exception);
      const message = this.formatClientMessage(
        this.resolveRawMessage(exception),
      );
      const errorResponse = this.buildErrorResponse(
        status,
        message,
        request,
        exception,
      );
      this.logException(status, request, exception, message);

      if (!response.headersSent) {
        response.status(status).json(errorResponse);
      }
    } catch (error) {
      this.sendFallbackResponse(response, error);
    }
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveRawMessage(exception: unknown): string | object {
    if (exception instanceof HttpException) {
      return exception.getResponse();
    }
    return 'Error interno del servidor';
  }

  private formatClientMessage(message: string | object): string {
    if (typeof message === 'string') {
      return message;
    }
    const payload = message as { message?: string };
    return payload.message ?? 'Error desconocido';
  }

  private buildErrorResponse(
    status: number,
    message: string,
    request: Request,
    exception: unknown,
  ): Record<string, unknown> {
    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      message,
    };

    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      return {
        ...errorResponse,
        path: request.url,
        method: request.method,
        stack: exception instanceof Error ? exception.stack : undefined,
        error:
          exception instanceof Error ? exception.message : String(exception),
      };
    }

    if (status < 500) {
      errorResponse.path = request.url;
    }
    return errorResponse;
  }

  private logException(
    status: number,
    request: Request,
    exception: unknown,
    clientMessage: string,
  ): void {
    const logLine = `${request.method} ${request.url} - ${status}`;

    if (status >= 500) {
      this.logger.error(
        logLine,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }

    this.logger.warn(`${logLine} - ${clientMessage}`);
  }

  private sendFallbackResponse(response: Response, error: unknown): void {
    this.logger.error('Error en el filtro de excepciones:', error);
    if (response.headersSent) {
      return;
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor',
    });
  }
}
