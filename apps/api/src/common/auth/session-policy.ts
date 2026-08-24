import { SESSION_IDLE_TTL_SECONDS } from '@churchflow/shared';

export { SESSION_IDLE_TTL_SECONDS };

export const SESSION_ABSOLUTE_TTL_SECONDS = 180 * 24 * 60 * 60;
export const SESSION_TOUCH_INTERVAL_SECONDS = 24 * 60 * 60;

export function sessionIdleExpiresAt(now: Date, absoluteExpiresAt: Date): Date {
  const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_TTL_SECONDS * 1000);

  return idleExpiresAt.getTime() > absoluteExpiresAt.getTime() ? absoluteExpiresAt : idleExpiresAt;
}

export function shouldTouchSession(lastUsedAt: Date | null, now: Date): boolean {
  if (lastUsedAt === null) {
    return true;
  }

  return now.getTime() - lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_SECONDS * 1000;
}
