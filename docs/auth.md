# Auth

Authentication is provider-based and intentionally avoids insecure login shortcuts.

## Providers

`auth_accounts` supports:

- Telegram

Each provider adapter must verify provider assertions server-side before linking an account.

## Telegram

Telegram login uses Telegram OpenID Connect Authorization Code Flow with PKCE.

API endpoints:

- `GET /v1/auth/telegram/start`: creates `state` and PKCE verifier cookies, then redirects to Telegram.
- `GET /v1/auth/telegram/callback`: exchanges the authorization code, validates the Telegram ID token with JWKS, and creates a session only when the Telegram account is already linked to an active platform admin, already linked to a user with active organization membership, matches a valid pending targeted invitation, or is returning to a valid claimable invitation acceptance link.

Unknown Telegram accounts are not auto-provisioned into regular app access. If the Telegram `sub` matches a pending targeted invitation, or the login was started from a valid claimable invitation link, the API may create/link the local user and redirect to the invitation acceptance experience. Organization dashboard content remains unavailable until the invitation is accepted and an active `OrganizationMember` row exists.

Required API environment:

```env
TELEGRAM_CLIENT_ID=
TELEGRAM_CLIENT_SECRET=
TELEGRAM_REDIRECT_URI=https://churchflow.test/v1/auth/telegram/callback
```

Register the exact `TELEGRAM_REDIRECT_URI` and the web origin in BotFather under Bot Settings > Web Login. For local setup, see `docs/local-https.md`.

## Sessions

Sessions store refresh token hashes, never raw refresh tokens. Browser flows should use secure, SameSite, httpOnly cookies.

Access JWT payloads contain only:

- `sub`: user id
- `sid`: session id
- `type`: `access`

Refresh tokens are opaque random strings stored in the refresh cookie and hashed in the `sessions` table. They are not JWTs in the current implementation.

Roles and permissions must not be treated as JWT truth. Organization permissions are checked through database membership state in API guards/services. RLS policies exist as a database foundation, but request-scoped RLS context is not wired yet.

Platform admins may sign in without organization membership only when their Telegram auth account is already linked to an active `User` whose `platformRole` is `ADMIN` or `SUPER_ADMIN`.
