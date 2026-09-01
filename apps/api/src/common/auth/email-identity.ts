// Addresses reach the database trimmed and lower-cased, but rows written before that was
// true still exist, so identity comparisons normalise both sides.
export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}
