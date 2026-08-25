import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = error instanceof HttpException;
    const status = isHttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status === SERVER_ERROR_STATUS;
    const message = error instanceof Error ? error.message : 'Unexpected server error';

    if (isServerError) {
      this.logger.error(
        {
          event: 'Unhandled request error',
          method: request.method,
          path: request.originalUrl,
          message,
        },
        error instanceof Error ? error.stack : undefined,
      );
    }

    response.status(status).json({
      ok: false,
      error: {
        code: isServerError ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED',
        message: isServerError ? 'Unexpected server error' : message,
      },
    });
  }
}
