# Auth

Authentication is provider-based and intentionally avoids insecure login shortcuts.

## Providers

`auth_accounts` supports:

- Telegram
- WebAuthn/passkeys
- Email magic links
- Google
- Apple

Each provider adapter must verify provider assertions server-side before linking an account.

## Sessions

Sessions store refresh token hashes, never raw refresh tokens. Browser flows should use secure, SameSite, httpOnly cookies.

Access JWT payloads contain only:

- `sub`: user id
- `sid`: session id
- `type`: `access`

Refresh tokens are opaque random strings stored in the refresh cookie and hashed in the `sessions` table. They are not JWTs in the current implementation.

Roles and permissions must not be treated as JWT truth. Organization permissions are checked through database membership state in API guards/services. RLS policies exist as a database foundation, but request-scoped RLS context is not wired yet.
