# RLS

Row level security is wired and enabled on five tables. It is a backstop, not the
authorization layer: guards and repository filters still enforce tenancy exactly as
before, and RLS exists to catch the case where one of them is forgotten.

## What is protected

`organization_members`, `organization_websites`, `website_pages`, `website_sections`,
`media_assets`. Every other table is unprotected so far.

## How identity reaches the database

`RequestContextMiddleware` opens an `AsyncLocalStorage` store for each request before
guards run. `SessionAuthGuard` writes the authenticated user id into that store once the
session is resolved. `PrismaService` reads it and issues, inside the same transaction as
the query:

```sql
select set_config('app.current_user_id', '<user-id>', true),
       set_config('app.system', '', true);
```

Both settings are transaction local, so they cannot leak between requests sharing a
connection. Single queries are batched together with the `set_config` call, which is why
every query now runs in a transaction. Interactive transactions set the context once, on
entry, and the query hook skips them.

## Requests without a user

Scheduled jobs and the Telegram webhook act on their own behalf. They declare it:
`ScheduledJobLockService.runOnce` wraps every scheduler, and `TelegramBotController`
wraps the webhook, in `RequestContextService.runAsSystem`. That sets `app.system` and the
`*_system` policies let those paths through.

This is the weak point of the design. Anything that wrongly runs as system gets full
access, so `runAsSystem` should stay confined to those two entry points.

A request with no user and no system flag sees nothing. Failing closed is deliberate.

## Turning it on

Policies only bite for a role that is not the table owner. Until `DATABASE_APP_URL` is
set the application connects as `churchflow`, which owns the tables and therefore
bypasses every policy — the migration is safe to deploy on its own and changes no
behaviour.

To activate, on the database:

```sql
alter role churchflow_app with login password '<password>';
```

Then set `DATABASE_APP_URL` for the API to that role's connection string. `DATABASE_URL`
stays as it is: migrations still run as the owner.

To switch it back off without a deployment:

```sql
alter table organization_members disable row level security;
```

## Helper functions

- `current_user_id()` — the request's user, or null.
- `app_is_system()` — whether this is a system path.
- `is_org_member(user_id, organization_id)`
- `has_org_permission(user_id, organization_id, permission)`

The last two are `security definer` on purpose: they read `organization_members`, which
is itself under a policy that calls them, and would otherwise recurse.

## What this does not do

RLS filters rows; it does not raise errors. A write that violates a policy affects zero
rows rather than failing, so a bug surfaces as missing data, not as an exception. Keep
the application-level filters.

## Notes on specific tables

Platform admin and organization admin are separate authorization domains. Platform admins
are represented by `users.platform_role`; organization admins by `organization_members.role`
inside a tenant.

`organization_requests` is not covered yet and must not be writable directly by public
database clients. Public submissions go through `POST /v1/organization-requests`.

`organization_members` policies treat `status = 'ACTIVE'` with `removed_at is null` as the
membership predicate. Removed members are retained for audit and history.
