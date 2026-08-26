export const EMAIL_LOGIN_TOKEN_TTL_SECONDS = 15 * 60;
export const EMAIL_LOGIN_MAX_CODE_ATTEMPTS = 5;
// Spent tokens carry the address, the requesting IP and the user agent. They are kept long
// enough to answer "who asked for this link" after an incident, and no longer.
export const EMAIL_LOGIN_TOKEN_RETENTION_SECONDS = 24 * 60 * 60;
// What needs limiting here is how much mail one address can be made to receive, and that is
// counted per address rather than per caller: the abuse is aimed at somebody's inbox, and the
// caller's address is not something this API can see behind the web app anyway.
export const EMAIL_LOGIN_REQUESTS_PER_WINDOW = 5;

export function emailLoginTokenExpiresAt(now: Date): Date {
  return new Date(now.getTime() + EMAIL_LOGIN_TOKEN_TTL_SECONDS * 1000);
}

export function emailLoginRequestWindowStart(now: Date): Date {
  return new Date(now.getTime() - EMAIL_LOGIN_TOKEN_TTL_SECONDS * 1000);
}
