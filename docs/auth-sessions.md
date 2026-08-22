# Authentication sessions

ChurchFlow uses a single opaque session token backed by a server-side `Session` row. There is no
access/refresh pair and no JWT: the token carries no claims, so the API answers every question about
a session by reading the row behind it.

- The raw token exists only in the `httpOnly` `churchflow_session` cookie, or in an
  `Authorization: Bearer` header for clients that cannot use cookies. The database stores its
  SHA-256 hash and never the token itself.
- `Session.expiresAt` is a sliding 30-day idle window. `Session.absoluteExpiresAt` is a hard 180-day
  ceiling that sliding never crosses.
- The idle window is pushed forward at most once every 24 hours, so ordinary reads do not turn into
  database writes. The cookie is re-issued with the same expiry at that moment, which means a
  browser that stops visiting drops the cookie exactly when the session stops being usable.
- Revocation is immediate. Logout, and any future session-management action, take effect on the very
  next request because there is no cached credential to outlive them.

## Request path

`SessionAuthGuard` hashes the presented token, loads the session and its user in one query, and
rejects anything revoked, idle-expired, past its ceiling, owned by a deleted user, or of a type other
than `user`. It then puts `{ userId, sessionId }` on the request. Organization authorization is a
separate concern: `OrganizationAccessGuard` reads current membership, role and permissions from the
database on every request, and the token is never a source of authorization truth.

## Web layer

The Next.js middleware runs for every application page. Session tokens are opaque, so it can only
see whether a session cookie exists; it never calls the API and never writes cookies. An anonymous
visitor is redirected to `/login`, and a visitor holding a cookie is passed through.

Whether that cookie still stands for a live session is answered by the API. `getCurrentUser` is the
single source of truth in the web layer: it skips the request entirely when no cookie is present and
is cached per render, so a page that reaches it through several helpers still makes one call.
`requireServerSession`, `requirePlatformAdmin` and `requireAdminOrganizationsAccess` build on it.

A render cannot write cookies, so a rejected visitor is redirected to `/signed-out`. That route
handler clears the cookies and forwards to `/login`, preserving the page they were trying to reach.

## Route policy

Public pages are explicitly allowlisted:

- `/`
- `/login`
- `/signed-out`
- `/o` and `/o/*`
- `/invitations/accept`
- `/member-claims/accept`
- `/platform-admin/bootstrap`

Every other application page is protected by default. Adding a genuinely public page requires an
explicit update to `apps/web/src/auth/route-policy.ts`. Public validation pages do not make their API
mutations public; guards remain authoritative.

A new Telegram login is required after logout, session revocation, user deletion, 30 days without
using the session, 180 days since it was created, or loss of the session cookie.

## Notes for future work

- The session token column is still physically named `refresh_token_hash` and is mapped to
  `tokenHash` in Prisma. Renaming it needs an expand/contract migration because the running API
  instance reads that column while a deploy applies migrations.
- `Session.deviceName` exists for the planned session-management screens and is not written yet.
- Expired sessions are never deleted; a retention job comparable to the notification one is still
  needed.
