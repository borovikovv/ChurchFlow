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
- `GET /v1/auth/telegram/callback`: exchanges the authorization code, validates the Telegram ID token with JWKS, and creates a session only when the Telegram account is already linked to an active platform admin, already linked to a user with active organization membership, matches a valid pending targeted invitation, is returning to a valid claimable invitation acceptance link, or is completing the one-time first-platform-admin bootstrap.

Unknown Telegram accounts are not auto-provisioned into regular app access. If the Telegram `sub` matches a pending targeted invitation, or the login was started from a valid claimable invitation link, the API may create/link the local user and redirect to the invitation acceptance experience. Organization dashboard content remains unavailable until the invitation is accepted and an active `OrganizationMember` row exists.

The first-admin bootstrap is a separate, short-lived admission condition. A valid bootstrap token may allow creation of a restricted authenticated session, but does not grant platform permissions during the OIDC callback. `SUPER_ADMIN` is assigned only when the authenticated Telegram user consumes the token in a single-use database transaction. Existing platform admins are redirected to `/admin/organizations` after login.

Required API environment:

```env
TELEGRAM_CLIENT_ID=
TELEGRAM_CLIENT_SECRET=
TELEGRAM_REDIRECT_URI=https://churchflow.test/v1/auth/telegram/callback
```

Register the exact `TELEGRAM_REDIRECT_URI` and the web origin in BotFather under Bot Settings > Web Login. For local setup, see `docs/local-https.md`.

## Sessions

Sessions store token hashes, never raw tokens. Browser flows use secure, SameSite, httpOnly cookies.

A session is a single opaque random token: there is no access/refresh pair and no JWT. The token carries no claims, so every request resolves the user by looking up the `sessions` row behind the hash. See `docs/auth-sessions.md` for lifetimes, device management and the web-layer flow.

Roles and permissions are never carried by the credential. Organization permissions are checked through database membership state in API guards/services. RLS policies exist as a database foundation, but request-scoped RLS context is not wired yet.

Platform admins may sign in without organization membership only when their Telegram auth account is already linked to an active `User` whose `platformRole` is `ADMIN` or `SUPER_ADMIN`.
