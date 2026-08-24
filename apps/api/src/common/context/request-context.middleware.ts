import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

// Сховище відкривається тут, до гардів: користувач ще невідомий, його
// підставить SessionAuthGuard уже всередині цього ж асинхронного контексту.
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(private readonly context: RequestContextService) {}

  use(_request: Request, _response: Response, next: NextFunction): void {
    this.context.run(() => {
      next();
    });
  }
}
