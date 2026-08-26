export const EMAIL_LOGIN_TOKEN_TTL_SECONDS = 15 * 60;
export const EMAIL_LOGIN_MAX_CODE_ATTEMPTS = 5;

export function emailLoginTokenExpiresAt(now: Date): Date {
  return new Date(now.getTime() + EMAIL_LOGIN_TOKEN_TTL_SECONDS * 1000);
}
