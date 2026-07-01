# Invitations

Organization invitations are tenant-scoped, provider-aware, and token-based. Raw tokens are never stored in the database.

The active authentication provider is Telegram. Targeted invitations store `targetProvider = telegram` and `targetProviderAccountId = <Telegram OIDC sub>`. Telegram usernames may be stored only as display metadata; they are not security identifiers. Email may be used as a notification/contact channel, but invitation acceptance is not bound to email.

For the MVP, normal member onboarding uses claimable links. The inviter generates a link for `MEMBER` or `VIEWER` and sends it manually, usually through Telegram. The first authenticated Telegram user who opens and accepts the link claims it; acceptance binds the invitation to that Telegram account and creates/reactivates membership. Owners can then promote an active member to `ADMIN` or `OWNER`, so normal onboarding never requires the inviter to know a Telegram OIDC `sub`.

Invitations are for people who do not yet have an organization membership. A manually
created registry member already has an `OrganizationMember`, so app access uses the
separate, approval-based `MembershipClaim` flow documented in
[`manual-members.md`](./manual-members.md). These two token types are not interchangeable.

## Security Rules

- Generate a cryptographically random token.
- Store `sha256(token)` as `OrganizationInvitation.tokenHash`.
- Email the raw token link through `EmailService` only when a notification email is provided.
- Keep delivery channels separate from identity binding. Email delivery does not prove invitation ownership.
- Require authentication to accept.
- For `targeted_telegram`, require the authenticated Telegram account to match the invitation target provider and provider account id.
- For `claimable_link`, allow only `MEMBER` and `VIEWER`; bind the invitation to the first authenticated Telegram account that accepts it.
- Prevent duplicate active members.
- Refresh an active pending targeted invite for the same organization, target provider, target provider account id, and status instead of creating duplicates.
- Refresh an expired, unaccepted targeted invite in place. A partial unique index applies only to pending provider-bound invitations, so accepted and revoked history remains append-only.
- Link invitations are single-use, expiring, revocable, and audited.
- Users with pending invitations must accept before seeing organization dashboard content.
- Organization owners can remove members through a soft-remove operation.
- Removing the last active owner is blocked.
- Owners cannot remove their own membership through the owner removal endpoint.

## Endpoints

- `POST /v1/organizations/:organizationId/invitations`
- `GET /v1/invitations/validate?token=...`
- `POST /v1/invitations/accept`
- `POST /v1/organizations/:organizationId/invitations/:id/revoke`
- `POST /v1/organizations/:organizationId/invitations/:id/resend`
- `POST /v1/organizations/:organizationId/memberships/:membershipId/remove`
- `PATCH /v1/organizations/:organizationId/memberships/:membershipId/role`

## Role Escalation

- `OWNER` may invite `OWNER`, `ADMIN`, `MEMBER`, or `VIEWER`.
- `ADMIN` may invite `MEMBER` or `VIEWER`.
- `MEMBER` and `VIEWER` may not invite.
- Claimable links must not grant `OWNER` or `ADMIN`.
- Only an active `OWNER` can change membership roles. Downgrading or removing the last active owner is blocked transactionally.

JWT claims must not replace organization membership checks. Frontend checks are advisory only; the API must continue to enforce roles and permissions from database membership state.

## Remaining Integration Boundaries

- OAuth provider assertions still require provider-specific verification before those providers can be enabled.
- S3/R2 signed upload and read URLs still require real storage credentials and provider SDK wiring.
- Runtime PostgreSQL RLS context is not wired into Prisma requests yet; API guards and service checks are the active enforcement layer.
