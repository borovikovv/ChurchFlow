# ChurchFlow

Production-oriented multi-tenant SaaS monorepo for organization administration, member care, and public organization websites.

## Stack

- Frontend: Next.js App Router, React, TypeScript
- Backend: Nest.js, TypeScript
- Database: PostgreSQL with Prisma
- Authorization: API guards/service checks today, with PostgreSQL RLS foundation prepared
- Auth foundation: provider-based auth for Telegram
- Storage: S3-compatible abstraction for Cloudflare R2 or AWS S3
- Monorepo: pnpm workspace and Turborepo

## Setup

1. Install Node.js 20+ and pnpm 9+.
2. Copy environment files:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env`
   - `cp packages/db/.env.example packages/db/.env`
3. Fill secrets with real values. Do not use placeholder JWT keys or storage credentials outside local development.
4. Start local services with `docker compose up -d`.
5. Install dependencies with `pnpm install`.
6. Generate Prisma Client with `pnpm db:generate`.
7. Create database migrations with `pnpm db:migrate`.
8. Apply `packages/db/sql/001_rls_foundation.sql` after Prisma has created the tables if you are testing the RLS foundation.
9. Bootstrap the first platform admin with `DATABASE_URL="postgresql://..." pnpm admin:promote admin@example.com SUPER_ADMIN`.
10. Run the workspace with `pnpm dev`.

For local Telegram Web Login testing, use the HTTPS proxy in `docs/local-https.md` instead of `localhost`.

## Auth Flow

- Users sign in through configured third-party providers from `/login`.
- `POST /v1/auth/provider` is retained for generic provider assertions, but active browser auth uses Telegram.
- Telegram OIDC is available through `GET /v1/auth/telegram/start` and `GET /v1/auth/telegram/callback`.
- Protected API routes read the access token from `Authorization: Bearer ...` or the `churchflow_access` cookie.
- `POST /v1/auth/refresh` mints a fresh access token from the httpOnly refresh cookie.
- Platform admins are regular users with `platformRole` set to `ADMIN` or `SUPER_ADMIN`.
- Organization owners are represented by `OrganizationMember` rows with role `OWNER`.

See `docs/organization-approval-flow.md`, `docs/platform-admin.md`, and `docs/invitations.md` for the full business and technical workflow.

## Scripts

- `pnpm dev` starts all dev servers through Turbo.
- `pnpm build` builds all apps and packages.
- `pnpm lint` runs lint tasks.
- `pnpm typecheck` runs strict TypeScript checks.
- `pnpm admin:promote <email> [ADMIN|SUPER_ADMIN]` promotes a platform admin through an operational CLI command.
- `pnpm db:generate` generates Prisma Client.
- `pnpm db:migrate` runs Prisma migrations.
- `pnpm db:studio` opens Prisma Studio.

## Security Notes

- Browser auth is prepared for httpOnly cookies. Do not add localStorage token storage.
- JWT payloads contain identity and session ids only; organization permissions must be checked through database membership state. Runtime RLS context is not wired yet.
- Refresh tokens must be stored only as hashes.
- S3/R2 credentials must stay server-side.
- Private CRM/member data must not be joined into public website queries.
