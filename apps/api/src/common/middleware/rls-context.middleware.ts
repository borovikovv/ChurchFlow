import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../guards/session-auth.guard';

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    void request;
    next();
  }
}
