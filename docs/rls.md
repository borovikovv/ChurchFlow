# RLS

Row level security is **not** implemented. Tenant isolation is enforced by API guards and
by repository filters, plus composite foreign keys that make cross-tenant rows
unwritable. This document records why RLS is not here and what it would take, so the
question does not have to be researched twice.

## What was here before

`packages/db/sql/001_rls_foundation.sql` used to describe a policy set. It had never run:
nothing referenced it — no script, Dockerfile, workflow or package script — and it was not
a migration, so `prisma migrate deploy` never saw it. It could not have run anyway. Its
`is_org_member` and `has_org_permission` filtered on `organization_members.deleted_at`, a
column that does not exist on that table; creating the functions would have failed. The
file has been removed rather than left to look like a foundation.

The membership predicate it should have used is `status = 'ACTIVE'` with
`removed_at is null`.

## What implementing it actually requires

This was built and measured against a live database, then removed as not worth its cost
yet. The findings:

- **The application connects as the table owner.** `DATABASE_URL` is the `churchflow`
  role, which owns the tables and runs migrations. Owners bypass policies, so RLS would
  be silently inert until the application connects as a separate non-owner role.
- **There is no request context.** No `AsyncLocalStorage`, no request-scoped providers.
  Identity has to be carried from the guard to the query, which means middleware plus a
  Prisma client extension.
- **Every single query would run in a transaction.** `set_config` is transaction local, so
  a standalone query has to be batched with it. That is an extra round trip per query and
  a longer connection hold.
- **Requests without a user need an explicit escape.** Four schedulers (all funnelling
  through `ScheduledJobLockService.runOnce`) and the Telegram webhook act with no session.
  Without a declared system context they would see nothing.
- **Failures are silent.** A policy filters rows; it does not raise. A misconfiguration
  shows up as missing data, not as an error, and the current unit tests use a fake Prisma
  client so none of them would notice.

## Why it was not kept

The only threat it defends against here is a forgotten `where organizationId`. No client
touches the database directly, everything goes through one API, and Prisma parameterises
queries. Against that single failure mode, integration tests over a real database with two
seeded organizations catch the same class of bug earlier and cost nothing at runtime.

If RLS is revisited, put the policies on the tables that hold personal and financial data
— `organization_member_profiles`, `prayer_requests`, `budget_entries` — rather than on the
public website tables the old file happened to cover.

## Notes that still apply

Platform admin and organization admin are separate authorization domains. Platform admins
are represented by `users.platform_role`; organization admins by
`organization_members.role` inside a tenant.

`organization_requests` must not be writable directly by public database clients. Public
submissions go through `POST /v1/organization-requests`.

`organization_invitations` acceptance happens through the backend so token hashing,
provider matching and audit logging stay centralised.

Removed members are retained for audit and history, so any future policy has to treat
`status = 'ACTIVE'` with `removed_at is null` as the membership predicate.
