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

/**
 * Most failures are indistinguishable to a client, so they all answer REQUEST_FAILED. An
 * exception thrown with an explicit `code` in its response body is opting out of that, because
 * the client has to branch on it - a subscription refusal offers billing, a permission refusal
 * does not.
 */
function explicitErrorCode(error: unknown): string | null {
  if (!(error instanceof HttpException)) {
    return null;
  }

  const response: unknown = error.getResponse();
  if (typeof response !== 'object' || response === null) {
    return null;
  }

  const code: unknown = (response as { code?: unknown }).code;

  return typeof code === 'string' && code.length > 0 ? code : null;
}

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
        code: isServerError
          ? 'INTERNAL_SERVER_ERROR'
          : (explicitErrorCode(error) ?? 'REQUEST_FAILED'),
        message: isServerError ? 'Unexpected server error' : message,
      },
    });
  }
}
