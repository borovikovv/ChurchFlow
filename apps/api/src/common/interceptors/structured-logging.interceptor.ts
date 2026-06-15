import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(StructuredLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = this.getRequestId(request);

    response.setHeader('x-request-id', requestId);

    return next.handle().pipe(
      tap(() => {
        this.logRequest({
          requestId,
          request,
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      }),
      catchError((error: unknown) => {
        this.logRequest({
          requestId,
          request,
          statusCode: this.getErrorStatus(error),
          durationMs: Date.now() - startedAt,
          error,
        });
        throw error;
      }),
    );
  }

  private getRequestId(request: Request): string {
    const header = request.headers['x-request-id'];
    if (Array.isArray(header)) {
      return header[0] ?? randomUUID();
    }

    return header ?? randomUUID();
  }

  private getErrorStatus(error: unknown): number {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const status = error.status;
      if (typeof status === 'number') {
        return status;
      }
    }

    return 500;
  }

  private logRequest(input: {
    requestId: string;
    request: Request;
    statusCode: number;
    durationMs: number;
    error?: unknown;
  }): void {
    const payload = {
      requestId: input.requestId,
      method: input.request.method,
      path: input.request.originalUrl,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
      userAgent: input.request.headers['user-agent'],
      error: input.error instanceof Error ? input.error.message : undefined,
    };

    const message = JSON.stringify(payload);
    if (input.statusCode >= 500) {
      this.logger.error(message);
      return;
    }

    if (input.statusCode >= 400) {
      this.logger.warn(message);
      return;
    }

    this.logger.log(message);
  }
}
