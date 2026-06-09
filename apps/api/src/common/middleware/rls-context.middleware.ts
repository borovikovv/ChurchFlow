import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard';

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    // TODO: Bind request.auth.sub to SET LOCAL app.current_user_id inside DB transactions.
    void request;
    next();
  }
}
