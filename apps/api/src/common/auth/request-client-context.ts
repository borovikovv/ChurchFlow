import type { Request } from 'express';

export interface RequestClientContext {
  userAgent?: string;
  ipAddress?: string;
}

export function requestClientContext(request: Request): RequestClientContext {
  const userAgent = request.headers['user-agent'];
  const ipAddress = request.ip;

  return {
    ...(userAgent ? { userAgent } : {}),
    ...(ipAddress ? { ipAddress } : {}),
  };
}
