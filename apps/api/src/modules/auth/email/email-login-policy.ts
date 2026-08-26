export const EMAIL_LOGIN_TOKEN_TTL_SECONDS = 15 * 60;
export const EMAIL_LOGIN_MAX_CODE_ATTEMPTS = 5;
// Spent tokens carry the address, the requesting IP and the user agent. They are kept long
// enough to answer "who asked for this link" after an incident, and no longer.
export const EMAIL_LOGIN_TOKEN_RETENTION_SECONDS = 24 * 60 * 60;

export function emailLoginTokenExpiresAt(now: Date): Date {
  return new Date(now.getTime() + EMAIL_LOGIN_TOKEN_TTL_SECONDS * 1000);
}
