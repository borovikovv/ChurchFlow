import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';

@Injectable()
export class StructuredLoggingInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // TODO: Attach request ids and structured pino logs for request lifecycle events.
    return next.handle();
  }
}
