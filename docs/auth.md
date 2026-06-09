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

Sessions store refresh token hashes, never raw refresh tokens. Browser flows should use secure, SameSite, httpOnly cookies. JWT payloads should contain only:

- `sub`: user id
- `sid`: session id
- `type`: access or refresh

Roles and permissions must not be treated as JWT truth. Organization permissions are checked through database membership state and RLS policies.
