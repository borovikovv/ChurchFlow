import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error instanceof Error ? error.message : 'Unexpected server error';

    response.status(status).json({
      ok: false,
      error: {
        code: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED',
        message: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Unexpected server error' : message
      }
    });
  }
}
