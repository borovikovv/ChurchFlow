# ADR 0007: Opaque Session Tokens Instead of Access JWTs

## Status

Accepted; implemented

## Context

Authentication previously used a 15-minute RSA-signed access JWT alongside an opaque refresh token
and a server-side `Session` row. The guard verified the JWT signature and then loaded the session and
its user from PostgreSQL on every request, so the short-lived token bought none of the statelessness
it costs. Removing that lookup was considered and rejected.

The reasoning was specific to this system rather than to JWTs in general:

- There is one consumer of the credential. The browser never calls the API directly; the Next.js
  server does, and the Telegram bot is a webhook authenticated by a path secret. A stateless token
  pays for verification without shared state, and here the verifier already sits next to the
  database.
- Authorization was already stateful. `OrganizationAccessGuard` reads membership, role and
  permissions per request, and ADR 0002 makes database state the authorization truth. Dropping the
  session lookup would have removed one query out of three, not made requests state-free.
- The JWT was hand-rolled. Signing, verification, base64url encoding and claim validation were
  implemented three times over `node:crypto` and WebCrypto, without `iss`, `aud`, `kid` or key
  rotation.
- A mobile client, the usual argument for JWTs, argues the other way here: it needs long sessions,
  per-device records and immediate remote revocation of a lost phone, all of which are server-side
  session features.

## Decision

A session is a single opaque random token. The database stores only its SHA-256 hash. There is no
access token, no refresh token, no `/auth/refresh` endpoint and no signing key. The token is carried
in an `httpOnly` cookie or an `Authorization: Bearer` header. Lifetime is a 30-day sliding idle
window under a 180-day absolute ceiling, with the idle window advanced at most once every 24 hours.

## Consequences

Logout, revocation and account deletion take effect on the next request rather than after a token
expires. Sessions become first-class rows that can carry device metadata, which is what future
session-management screens need.

Every authenticated request costs one indexed lookup. That was already true; the change is that the
lookup is now the whole of authentication rather than an addition to it.

The Next.js middleware can no longer judge a session locally. It checks only that a cookie exists,
and the API decides; a rejected visitor is redirected to `/signed-out`, which clears the cookies. In
exchange, roughly 250 lines of hand-written cryptography and the entire refresh flow — including
three independent refresh call sites in the web layer — were deleted.

ADR 0002 still holds: the credential carries identity, never organization authorization. Its wording
predates this decision and describes that credential as a JWT; the principle is unchanged, only the
token format is.
