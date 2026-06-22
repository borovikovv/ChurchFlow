# Platform Admin

Platform admin access is separate from organization membership.

## Roles

- `USER`: normal account.
- `ADMIN`: can review organization requests and manage organization lifecycle.
- `SUPER_ADMIN`: same as admin for MVP, reserved for higher-trust platform operations.

The API enforces platform admin access with `PlatformAdminGuard`, which currently checks `User.platformRole` after `JwtAuthGuard` populates `request.auth`.

## Bootstrap

The first platform admin is promoted through an operational CLI command, not through a public HTTP endpoint:

```sh
DATABASE_URL="postgresql://..." pnpm admin:promote admin@example.com SUPER_ADMIN
```

The role argument is optional and defaults to `SUPER_ADMIN`; allowed values are `ADMIN` and `SUPER_ADMIN`.

The command:

- normalizes the email address
- creates the user if it does not exist
- refuses to promote a soft-deleted user
- updates only `User.platformRole`
- records an `audit_logs` entry with action `PROMOTE_PLATFORM_ADMIN`

This does not create a login shortcut. The promoted admin still signs in through a configured third-party provider account. With Telegram auth, that means the admin must have a linked Telegram auth account; the system must not infer platform admin identity from a Telegram username or from an unverified login attempt.

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
