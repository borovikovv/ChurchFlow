# ADR 0006: Organization Approval and Invitations

## Status

Accepted

## Context

ChurchFlow is a multi-tenant SaaS where anonymous organization creation would create tenant and security risk if it directly provisioned organizations. Authentication is Telegram-first, and normal users should not need to know a Telegram OIDC `sub`.

## Decision

Organization creation starts as an authenticated `OrganizationRequest`. Platform admins approve requests, and approval creates the organization, default website, and active owner membership for `requestedByUserId` in one transaction.

Invitations separate identity binding from delivery. Invitation tokens are raw only in delivery links and stored in the database as SHA-256 hashes.

Two invitation modes are supported:

- `targeted_telegram`: bound to `targetProvider = telegram` and `targetProviderAccountId = <Telegram OIDC sub>`. Use for `OWNER`, `ADMIN`, or existing users whose linked Telegram account is already known.
- `claimable_link`: starts without a provider target, is allowed only for `MEMBER` and `VIEWER`, and is claimed by the first authenticated Telegram user who accepts it.

Email may be used for notification delivery, but it is not the identity proof for acceptance. The target model is intentionally extensible for future email, phone, Google, Apple, or other providers once provider-specific assertions are implemented.

Platform admin privileges use `User.platformRole`, separate from `OrganizationMember.role`.

## Consequences

- Public users cannot directly create tenant records.
- Unknown Telegram users cannot auto-provision themselves into app access without a pending invitation, active membership, or existing platform-admin account.
- Normal member invitation does not require admins to know another user's Telegram OIDC `sub`.
- Approval, rejection, invitation, acceptance, revoke, resend, and lifecycle operations are auditable.
- Authenticated organization endpoints verify JWT access cookies and active sessions before checking organization membership or platform-admin state in the database.
- Users with pending invitations must accept before seeing organization dashboard content.
