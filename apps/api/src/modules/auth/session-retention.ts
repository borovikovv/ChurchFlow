const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const SESSION_RETENTION_BATCH_SIZE = 5_000;

export const SESSION_RETENTION_MAX_BATCHES = 200;

// A session stops being usable the moment it is revoked or passes its ceiling. The rows
// are kept for a while after that so recent sign-ins stay visible to their owner and to
// anyone investigating an incident.
export function resolveSessionRetentionCutoff(now: Date, retentionDays: number): Date {
  return new Date(now.getTime() - retentionDays * MS_PER_DAY);
}
