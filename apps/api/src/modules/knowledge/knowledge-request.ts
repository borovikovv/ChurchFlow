import type { AuthenticatedRequest } from '../../common/guards/session-auth.guard';

export function actorUserId(request: AuthenticatedRequest): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new Error('Authenticated request missing auth payload');
  }

  return userId;
}
