# Database

The Prisma schema models users, provider accounts, sessions, organizations, organization requests, organization members and invitations, organization websites, pages, sections, domains, media assets, audit logs, and feature flags.

## Conventions

- UUID primary keys.
- `created_at` and `updated_at` timestamps.
- `deleted_at` on soft-deletable records.
- Tenant-owned records include `organization_id`.
- Platform admin state is stored on `users.platform_role`; organization authorization is stored in `organization_members`.
- Public website records are separated from private CRM/member data.
- Provider accounts are unique by provider and provider account id.
- Page slugs are unique per website.

## Migration Flow

Use Prisma to generate table migrations:

```bash
pnpm db:migrate
```

There is no second step. Row level security is not implemented, and the SQL file this section
used to point at was removed rather than left looking like a foundation: it had never run and
could not have. API guards, service checks and composite foreign keys are the authorization
layer. See `docs/rls.md` for the measurements behind that decision.
