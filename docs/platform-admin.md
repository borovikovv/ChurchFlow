# Platform Admin

Platform admin access is separate from organization membership.

## Roles

- `USER`: normal account.
- `ADMIN`: can review organization requests and manage organization lifecycle.
- `SUPER_ADMIN`: same as admin for MVP, reserved for higher-trust platform operations.

The API enforces platform admin access with `PlatformAdminGuard`, which currently checks `User.platformRole` after `JwtAuthGuard` populates `request.auth`.

## Bootstrap

The first platform super administrator is created through a protected operational CLI plus verified Telegram OIDC:

```sh
DATABASE_URL="postgresql://..." \
WEB_APP_URL="https://app.example.com" \
pnpm admin:bootstrap
```

The command:

- refuses to run if an active `SUPER_ADMIN` already exists
- refuses to create a second unexpired bootstrap
- generates a cryptographically random single-use token
- stores only `sha256(token)` with a short expiry
- records bootstrap creation in `audit_logs`
- prints a one-time Web URL

The operator opens the URL and completes Telegram OIDC. The callback may create a restricted session only because the bootstrap token is valid. Consuming the token verifies that the user has an active linked Telegram account, atomically marks the token consumed, sets `User.platformRole = SUPER_ADMIN`, and records `PROMOTE_PLATFORM_ADMIN` in the audit log.

After bootstrap, platform admins sign in normally and are redirected to `/admin/organizations`. The CLI cannot be used to create more admins. Future admin promotion should be an authenticated `SUPER_ADMIN` operation with re-authentication and audit history.

## Organization Lifecycle

Platform admins can:

- list organizations
- view organization details
- approve authenticated Telegram organization requests, creating the organization, website, and owner membership transactionally
- create organizations directly through the protected admin API when needed
- archive
- suspend
- restore
- soft delete

Soft delete sets `status = DELETED` and `deletedAt`; it does not hard-delete tenant data.
