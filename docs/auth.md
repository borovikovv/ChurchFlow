# Auth

Authentication is provider-based and intentionally avoids insecure login shortcuts.

## Providers

`auth_accounts` supports:

- Telegram
- Email
- Passkey (WebAuthn)

Each provider adapter must verify provider assertions server-side before linking an account.

No provider self-provisions an account. Admission is decided the same way whatever the
credential: an active organization membership, a platform-admin account, an organization
request, a membership claim, or a link carrying its own token.

## Telegram

Telegram login uses Telegram OpenID Connect Authorization Code Flow with PKCE.

API endpoints:

- `GET /v1/auth/telegram/start`: creates `state` and PKCE verifier cookies, then redirects to Telegram.
- `GET /v1/auth/telegram/callback`: exchanges the authorization code, validates the Telegram ID token with JWKS, and creates a session only when the Telegram account is already linked to an active platform admin, already linked to a user with active organization membership, matches a valid pending targeted invitation, is returning to a valid claimable invitation acceptance link, or is completing the one-time first-platform-admin bootstrap.

Unknown Telegram accounts are not auto-provisioned into regular app access. If the Telegram `sub` matches a pending targeted invitation, or the login was started from a valid claimable invitation link, the API may create/link the local user and redirect to the invitation acceptance experience. Organization dashboard content remains unavailable until the invitation is accepted and an active `OrganizationMember` row exists.

The first-admin bootstrap is a separate, short-lived admission condition. A valid bootstrap token may allow creation of a restricted authenticated session, but does not grant platform permissions during the OIDC callback. `SUPER_ADMIN` is assigned only when the authenticated Telegram user consumes the token in a single-use database transaction. Existing platform admins are redirected to `/admin/organizations` after login.

Required API environment:

```env
TELEGRAM_CLIENT_ID=
TELEGRAM_CLIENT_SECRET=
TELEGRAM_REDIRECT_URI=https://churchflow.test/v1/auth/telegram/callback
```

Register the exact `TELEGRAM_REDIRECT_URI` and the web origin in BotFather under Bot Settings > Web Login. For local setup, see `docs/local-https.md`.

## Email

Email sign-in is a single-use token delivered two ways in one message: a link, and a
six-digit code for the case where the mail is opened on a different device than the one
signing in. Both live in the same `email_login_tokens` row, so using either retires both.

- `POST /v1/auth/email/request` always answers `202`, whether or not the address can sign
  in. The answer must never differ, or the endpoint becomes an account-enumeration oracle.
- `GET /v1/auth/email/callback` consumes the link. The row is claimed with
  `UPDATE ... WHERE consumed_at IS NULL`, which is what makes a second use impossible.
- `POST /v1/auth/email/code` consumes the code. Wrong codes increment `attempt_count`, and
  the fifth failure burns the token rather than the guess: six digits are otherwise too few.
- Tokens are stored as SHA-256 hashes. The code is stored under scrypt instead, because six
  digits carry too little entropy for a plain digest to survive a database dump.
- Admission is resolved twice, when the mail is sent and again when the token is used, since
  access can be withdrawn inside the fifteen minutes a token is valid for.
- How many links one address can be sent in that window is capped, and hitting the cap is as
  silent as not being admitted. The count is per address rather than per caller: the abuse
  worth stopping is aimed at somebody's inbox, and the caller's own address is not something
  this API can see behind the web app. Confirmation emails are capped the same way, but say
  so out loud, because that caller is already signed in and has nothing to discover.

An address becomes an identity only once its owner has proved they hold it, and coming back
with the link or the code is that proof. So email sign-in does _not_ refuse an address the
account has never confirmed: the mail was only ever delivered to the address itself, and
redeeming it confirms the address in the same step, exactly as a verification link would
have. Refusing at that point would demand a confirmation that could never happen, because
confirming an address needs a session and this is the way to one. An account created _by_
email sign-in is verified at creation for the same reason.

Everywhere else, an unconfirmed address is still only contact data: it is not an acceptance
identity for invitations or membership claims, and it does not make somebody eligible to ask
for an organization.

Confirming an address on an existing account is a separate, authenticated flow:
`POST /v1/auth/email/verify/request` sends the link, and `GET /v1/auth/email/verify`
confirms it. Changing the address in the profile withdraws `emailVerified` and deletes the
email auth account in the same transaction, so the old address stops being a key at once.

## Passkeys

Passkeys are WebAuthn credentials verified with `@simplewebauthn/server`. Registration
requires an existing session, so a passkey never creates an account; it is a way back into
one.

- Credentials are discoverable (`residentKey: 'required'`), which is what lets `/login` offer
  one button instead of asking who is signing in first.
- User verification is requested but not required. The two settings must agree: demanding it
  at verification time would reject the authenticators the request deliberately allowed.
- Challenges live in `webauthn_challenges` as hashes and are consumed atomically inside the
  verifier's `expectedChallenge` callback, so a replayed challenge fails without a cookie
  being involved.
- `signCount` regression is treated as a cloned authenticator. The check applies only once a
  credential has proved it counts, because most passkeys report zero forever.
- Removing a passkey is refused when it is the last sign-in method on the account, and the
  row is deleted outright rather than soft-deleted so the same authenticator can be
  registered again.

Relying party identity defaults to the host and origin of `WEB_APP_URL`. Override with
`WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME` and `WEBAUTHN_ORIGINS` (comma separated) when the
browser origin differs from the web app URL. WebAuthn requires HTTPS, so local testing goes
through the proxy in `docs/local-https.md` and the RP ID must match that hostname exactly.

## Sessions

Sessions store token hashes, never raw tokens. Browser flows use secure, SameSite, httpOnly cookies.

A session is a single opaque random token: there is no access/refresh pair and no JWT. The token carries no claims, so every request resolves the user by looking up the `sessions` row behind the hash. See `docs/auth-sessions.md` for lifetimes, device management and the web-layer flow.

Roles and permissions are never carried by the credential. Organization permissions are checked through database membership state in API guards/services. RLS policies exist as a database foundation, but request-scoped RLS context is not wired yet.

Platform admins may sign in without organization membership only when their auth account is already linked to an active `User` whose `platformRole` is `ADMIN` or `SUPER_ADMIN`.
