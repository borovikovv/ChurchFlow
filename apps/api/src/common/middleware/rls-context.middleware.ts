import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard';

@Injectable()
export class RlsContextMiddleware implements NestMiddleware {
  use(request: AuthenticatedRequest, _response: Response, next: NextFunction): void {
    // JWT guards populate request.auth after middleware has already run. Organization access is
    // enforced by guards until Prisma queries are wrapped in request-scoped RLS transactions.
    void request;
    next();
  }
}
