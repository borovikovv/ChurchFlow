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

## Endpoints

- `POST /v1/organizations/:organizationId/invitations`
- `GET /v1/invitations/validate?token=...`
- `POST /v1/invitations/accept`
- `POST /v1/organizations/:organizationId/invitations/:id/revoke`
- `POST /v1/organizations/:organizationId/invitations/:id/resend`

## Role Escalation

- `OWNER` may invite `OWNER`, `ADMIN`, `MEMBER`, or `VIEWER`.
- `ADMIN` may invite `MEMBER` or `VIEWER`.
- `MEMBER` and `VIEWER` may not invite.

Real permission claims can later replace the current membership lookup, but frontend checks must remain advisory only.
