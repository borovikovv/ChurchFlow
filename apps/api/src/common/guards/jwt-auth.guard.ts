import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { jwtPayloadSchema, type JwtPayload } from '@churchflow/shared';

export interface AuthenticatedRequest extends Request {
  auth?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');

    // TODO: Verify RS256 JWTs with configured public keys and prefer httpOnly cookies for browsers.
    if (!bearer) {
      throw new UnauthorizedException('Missing access token');
    }

    const placeholderPayload = jwtPayloadSchema.safeParse({
      sub: '00000000-0000-0000-0000-000000000000',
      sid: '00000000-0000-0000-0000-000000000000',
      type: 'access'
    });

    if (!placeholderPayload.success) {
      throw new UnauthorizedException('Invalid access token');
    }

    request.auth = placeholderPayload.data;
    return true;
  }
}
