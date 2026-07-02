# Authentication sessions

ChurchFlow uses a short-lived RSA-signed access JWT and an opaque refresh token backed by a
server-side `Session` row.

- Access tokens expire after 15 minutes.
- Refresh sessions expire 30 days after login.
- The 30-day expiry is absolute, not sliding. Refreshing access does not update `Session.expiresAt`
  and does not rotate the refresh token.
- The raw refresh token exists only in an `httpOnly` cookie. The database stores its SHA-256 hash.
- Logout revokes the server-side session and clears both authentication cookies.

The Next.js middleware runs for every application page. It refreshes an expired access token before
the page or Server Action executes and injects the new access cookie into both the current request
and the browser response. Static assets, Next.js internals, and API paths (`/api/*` and the `/v1/*`
rewrite) are excluded. API authentication remains enforced by Nest guards.

The middleware verifies the access JWT signature with `JWT_ACCESS_PUBLIC_KEY` before trusting its
expiry. The web and API services must receive the same access public key. A malformed, modified, or
expired access token is refreshed when a valid refresh session remains.

## Route policy

Public pages are explicitly allowlisted:

- `/`
- `/login`
- `/o` and `/o/*`
- `/invitations/accept`
- `/member-claims/accept`
- `/platform-admin/bootstrap`

Every other application page is protected by default. Adding a genuinely public page requires an
explicit update to `apps/web/src/auth/route-policy.ts`. Public validation pages do not make their API
mutations public; guards remain authoritative.

A new Telegram login is required after 30 days, logout, session revocation, user deletion, removal
of the refresh cookie, or an invalid refresh token.

The universal server-side `apiFetch` intentionally does not implement an independent refresh retry.
Server Components cannot reliably persist cookies in every execution context, while middleware runs
before pages and Server Actions and can update both the current request and response consistently.
