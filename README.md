# ChurchFlow

Production-oriented multi-tenant SaaS monorepo for organization administration, member care, and public organization websites.

## Stack

- Frontend: Next.js App Router, React, TypeScript
- Backend: Nest.js, TypeScript
- Database: PostgreSQL with Prisma
- Authorization: PostgreSQL RLS-first design
- Auth foundation: provider-based auth prepared for passkeys/WebAuthn, Telegram, magic links, Google, and Apple
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
8. Apply `packages/db/sql/001_rls_foundation.sql` after Prisma has created the tables.
9. Run the workspace with `pnpm dev`.

## Auth Flow

- Users sign in with email magic links from `/login`.
- `POST /v1/auth/email/start` stores a single-use hashed login token and sends the link.
- `/login/verify?token=...` verifies the token, creates or updates the `User`, `AuthAccount`, and `Session`, then sets httpOnly auth cookies.
- Protected API routes read the access token from `Authorization: Bearer ...` or the `churchflow_access` cookie.
- `POST /v1/auth/refresh` mints a fresh access token from the httpOnly refresh cookie.
- Platform admins are regular users with `platformRole` set to `ADMIN` or `SUPER_ADMIN`.
- Organization owners are represented by `OrganizationMember` rows with role `OWNER`.

See `docs/current-workflow.md` for the full business and technical workflow.

## Scripts

- `pnpm dev` starts all dev servers through Turbo.
- `pnpm build` builds all apps and packages.
- `pnpm lint` runs lint tasks.
- `pnpm typecheck` runs strict TypeScript checks.
- `pnpm db:generate` generates Prisma Client.
- `pnpm db:migrate` runs Prisma migrations.
- `pnpm db:studio` opens Prisma Studio.

## Security Notes

- Browser auth is prepared for httpOnly cookies. Do not add localStorage token storage.
- JWT payloads contain identity and session ids only; organization permissions must be checked through DB/RLS.
- Refresh tokens must be stored only as hashes.
- S3/R2 credentials must stay server-side.
- Private CRM/member data must not be joined into public website queries.
