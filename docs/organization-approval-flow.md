# Organization Approval Flow

ChurchFlow does not create organizations directly from public submissions. Public requests are stored as `OrganizationRequest` records with `PENDING` status and reviewed by platform admins.

The canonical production path is organization request approval. Direct `POST /v1/organizations` is protected by `JwtAuthGuard` and `PlatformAdminGuard`; normal authenticated users cannot create active organizations or make themselves owners.

## Flow

1. A public visitor submits `POST /v1/organization-requests`.
2. The API validates input with shared Zod schemas and sends a platform admin notification through `EmailService`.
3. A platform admin reviews requests in `/admin/organization-requests`.
4. Approval runs in a database transaction:
   - verifies the request is still `PENDING`
   - claims the pending request before creating tenant records
   - rejects duplicate organization slugs
   - creates an `Organization` with `ACTIVE` status
   - creates the default `OrganizationWebsite`
   - creates an `OrganizationInvitation` for the contact email with `OWNER` role
   - stores only `tokenHash`
   - marks the request `APPROVED`
5. The raw invitation token is sent only through the email provider.
6. Rejection marks the request `REJECTED`, stores the reason, and records audit history.
7. The contact accepts the owner invitation while signed in as the matching verified email address.
8. Acceptance creates the active `OrganizationMember` row with role `OWNER`.

## Admin Endpoints

- `GET /v1/admin/organization-requests`
- `GET /v1/admin/organization-requests/:id`
- `POST /v1/admin/organization-requests/:id/approve`
- `POST /v1/admin/organization-requests/:id/reject`

Only users with `platformRole` `ADMIN` or `SUPER_ADMIN` may approve or reject.
