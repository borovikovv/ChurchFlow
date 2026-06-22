# Organization Approval Flow

ChurchFlow does not create organizations directly from anonymous public submissions. Organization requests are created by authenticated Telegram users, stored as `OrganizationRequest` records with `PENDING` status, and reviewed by platform admins.

The canonical production path is organization request approval. Direct `POST /v1/organizations` is protected by `JwtAuthGuard` and `PlatformAdminGuard`; normal authenticated users cannot create active organizations or make themselves owners.

## Flow

1. A requester signs in with Telegram and submits `POST /v1/organization-requests`.
2. The API validates input with shared Zod schemas and sends a platform admin notification through `EmailService`.
3. A platform admin reviews requests in `/admin/organization-requests`.
4. Approval runs in a database transaction:
   - verifies the request is still `PENDING`
   - claims the pending request before creating tenant records
   - rejects duplicate organization slugs
   - creates an `Organization` with `ACTIVE` status
   - creates the default `OrganizationWebsite`
   - creates an active `OrganizationMember` row for `requestedByUserId` with role `OWNER`
   - marks the request `APPROVED`
5. Rejection marks the request `REJECTED`, stores the reason, records audit history, and emails the contact only when contact email exists.

The requester does not type a Telegram OIDC `sub`. Telegram identity is captured by login and stored as `requestedByUserId`. Contact email/phone remain optional communication fields, not identity binding.

## Admin Endpoints

- `GET /v1/admin/organization-requests`
- `GET /v1/admin/organization-requests/:id`
- `POST /v1/admin/organization-requests/:id/approve`
- `POST /v1/admin/organization-requests/:id/reject`

Only users with `platformRole` `ADMIN` or `SUPER_ADMIN` may approve or reject.
