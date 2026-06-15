# Database

The Prisma schema models users, provider accounts, email login tokens, sessions, organizations, organization requests, organization members and invitations, organization websites, pages, sections, domains, media assets, audit logs, and feature flags.

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

After tables exist, apply:

```bash
psql "$DATABASE_URL" -f packages/db/sql/001_rls_foundation.sql
```

The RLS SQL defines identity helpers and foundation policies for organization members, websites, pages, sections, and media assets. API guards and service checks remain the active runtime authorization layer until request-scoped RLS context is implemented.
