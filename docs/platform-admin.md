# Platform Admin

Platform admin access is separate from organization membership.

## Roles

- `USER`: normal account.
- `ADMIN`: can review organization requests and manage organization lifecycle.
- `SUPER_ADMIN`: same as admin for MVP, reserved for higher-trust platform operations.

The API enforces platform admin access with `PlatformAdminGuard`, which currently checks `User.platformRole` after `JwtAuthGuard` populates `request.auth`.

## Organization Lifecycle

Platform admins can:

- list organizations
- view organization details
- archive
- suspend
- restore
- soft delete

Soft delete sets `status = DELETED` and `deletedAt`; it does not hard-delete tenant data.
