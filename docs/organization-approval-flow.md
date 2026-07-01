# Organization Approval Flow

ChurchFlow does not create organizations directly from anonymous public submissions. A new Telegram user may create a restricted account only when login starts from `/organization-request` or `/organization-request/status`. The restricted account can submit and inspect its own requests, but has no tenant access until approval creates a membership.

Telegram authorization uses state, PKCE, and an OIDC nonce stored in short-lived `httpOnly` cookies. Return URLs are canonicalized against `WEB_APP_URL`; external origins, backslashes, protocol-relative URLs, control characters, and encoded path separators are rejected. Telegram `sub` remains the only login identity.

The canonical production path is organization request approval. Direct `POST /v1/organizations` is an explicit administrative bypass protected by `JwtAuthGuard` and `PlatformAdminGuard`; normal authenticated users cannot create active organizations or make themselves owners. The platform admin who uses this endpoint becomes the active `OWNER`, and organization, website, membership, and audit records are created atomically.

## Flow

1. A requester signs in with Telegram and submits `POST /v1/organization-requests`.
2. The API validates input with shared Zod schemas, creates the request and audit record atomically, and then sends a best-effort platform admin notification through `EmailService`.
3. A platform admin reviews requests in `/admin/organization-requests`.
4. Approval runs in a database transaction:
   - verifies the request is still `PENDING`
   - claims the pending request before creating tenant records
   - rejects duplicate organization slugs
   - creates an `Organization` with `ACTIVE` status
   - creates the default `OrganizationWebsite`
   - creates an active `OrganizationMember` row for `requestedByUserId` with role `OWNER`
   - marks the request `APPROVED`
   - records membership and approval audit entries
5. Rejection marks the request `REJECTED`, stores the reason, records audit history, and emails the contact only when contact email exists.
6. The requester follows progress at `/organization-request/status`; approval also sends a best-effort email when contact email exists.

The requester does not type a Telegram OIDC `sub`. Telegram identity is captured by login and stored as `requestedByUserId`. Contact email/phone remain optional communication fields, not identity binding.

Only one `PENDING` request is allowed per requester. This is enforced in the service and by a partial unique database index. Completed requests do not prevent the user from requesting another organization.

`PENDING` requests expire after 30 days. Expiry is applied lazily when a requester creates or reads requests and when platform admins list, review, approve, or reject them. Create, approve, and reject apply expiry inside their business transaction. A scheduler is not required: stale rows become `EXPIRED` before they can block a replacement request, while the partial unique index remains the final race-condition guard.

When approval does not receive an explicit slug, Ukrainian organization names are transliterated. If the name contains no usable characters, ChurchFlow generates `organization-<request-id-prefix>`. The final value is validated by the shared `slugSchema`; the database unique constraint remains authoritative and collisions return `409 Conflict`.

Email is deliberately outside business transactions. Delivery failure is logged and returned as `notificationSent: false`; it never rolls back a committed request, rejection, approval, organization, or membership.

## Admin Endpoints

- `GET /v1/admin/organization-requests`
- `GET /v1/admin/organization-requests/:id`
- `POST /v1/admin/organization-requests/:id/approve`
- `POST /v1/admin/organization-requests/:id/reject`

Authenticated requester endpoint:

- `GET /v1/organization-requests/mine`

Only users with `platformRole` `ADMIN` or `SUPER_ADMIN` may approve or reject.
