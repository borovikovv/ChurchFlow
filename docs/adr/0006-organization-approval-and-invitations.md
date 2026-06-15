# ADR 0006: Organization Approval and Invitations

## Status

Accepted

## Context

ChurchFlow is a multi-tenant SaaS where public organization creation would create tenant and security risk if it directly provisioned organizations.

## Decision

Organization creation starts as `OrganizationRequest`. Platform admins approve requests, and approval creates the organization plus an owner invitation in one transaction. Invitation tokens are raw only in email links and stored in the database as SHA-256 hashes.

Platform admin privileges use `User.platformRole`, separate from `OrganizationMember.role`.

## Consequences

- Public users cannot directly create tenant records.
- Approval, rejection, invitation, acceptance, revoke, resend, and lifecycle operations are auditable.
- Authenticated organization endpoints verify JWT access cookies and active sessions before checking organization membership or platform-admin state in the database.
