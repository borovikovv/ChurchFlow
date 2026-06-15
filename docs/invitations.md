# Invitations

Organization invitations are tenant-scoped and token-based. Raw tokens are never stored in the database.

## Security Rules

- Generate a cryptographically random token.
- Store `sha256(token)` as `OrganizationInvitation.tokenHash`.
- Email the raw token link through `EmailService`.
- Require authentication to accept.
- Require authenticated user email to match invitation email.
- Require `emailVerified` before accepting.
- Prevent duplicate active members.
- Refresh an active pending invite instead of creating duplicates.
- Link invitations are single-use, expiring, revocable, and audited.
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

## Role Escalation

- `OWNER` may invite `OWNER`, `ADMIN`, `MEMBER`, or `VIEWER`.
- `ADMIN` may invite `MEMBER` or `VIEWER`.
- `MEMBER` and `VIEWER` may not invite.

JWT claims must not replace organization membership checks. Frontend checks are advisory only; the API must continue to enforce roles and permissions from database membership state.

## Remaining Integration Boundaries

- OAuth/WebAuthn provider assertions still require provider-specific verification before those providers can be enabled.
- S3/R2 signed upload and read URLs still require real storage credentials and provider SDK wiring.
- Runtime PostgreSQL RLS context is not wired into Prisma requests yet; API guards and service checks are the active enforcement layer.
