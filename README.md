# ChurchFlow

Production-oriented multi-tenant SaaS monorepo for organization administration, member care, and public organization websites.

## Stack

- Frontend: Next.js App Router, React, TypeScript
- Backend: Nest.js, TypeScript
- Database: PostgreSQL with Prisma
- Authorization: API guards, service checks and composite foreign keys. Row level security is not implemented; see `docs/rls.md` for why and what it would take
- Auth foundation: provider-based auth for Telegram, email sign-in links, and passkeys
- Storage: S3-compatible abstraction for Cloudflare R2 or AWS S3
- Monorepo: pnpm workspace and Turborepo

## Setup

1. Install Node.js 20+ and pnpm 9+.
2. Copy the three separate environment files:
   - `cp apps/api/.env.example apps/api/.env`
   - `cp apps/web/.env.example apps/web/.env.local`
   - `cp packages/db/.env.example packages/db/.env`
3. Fill secrets with real values. Do not use placeholder storage or provider credentials outside local development.
4. Start local services with `docker compose up -d`.
5. Install dependencies with `pnpm install`.
6. Generate Prisma Client with `pnpm db:generate`.
7. Create database migrations with `pnpm db:migrate`.
8. Apply migrations, then bootstrap the first platform admin with `DATABASE_URL="postgresql://..." WEB_APP_URL="https://..." pnpm admin:bootstrap` and open the generated one-time Telegram URL.
9. Run the workspace with `pnpm dev`.

For local Telegram Web Login testing, use the HTTPS proxy in `docs/local-https.md` instead of `localhost`.

## Auth Flow

- Users sign in from `/login` with Telegram, an emailed link or code, or a passkey.
- `POST /v1/auth/provider` is retained for generic provider assertions and is not used by browser auth.
- Telegram OIDC is available through `GET /v1/auth/telegram/start` and `GET /v1/auth/telegram/callback`.
- Email sign-in runs through `POST /v1/auth/email/request`, then either `GET /v1/auth/email/callback` (link) or `POST /v1/auth/email/code` (six-digit code). The request endpoint always answers `202` so it cannot be used to discover which addresses have accounts.
- An address only becomes a sign-in identity once its owner confirms it, through `POST /v1/auth/email/verify/request`. Changing the address in the profile withdraws the confirmation.
- Passkeys are managed under the profile and used from `/login` through `POST /v1/auth/passkeys/login/options` and `POST /v1/auth/passkeys/login/verify`. Registering one needs an existing session, so a passkey never creates an account.
- Whatever the credential, admission is the same question: an active membership, a platform-admin account, an organization request, a membership claim, or a link carrying its own token.
- Telegram users are admitted when they match an active membership, an existing platform-admin account, a valid invitation, or an exact organization-onboarding route. Onboarding-only accounts remain tenant-restricted until an approved request creates an active membership.
- Protected API routes read the opaque session token from `Authorization: Bearer ...` or the `churchflow_session` cookie, and resolve it against the `sessions` table on every request.
- Sessions slide over a 30-day idle window up to a 180-day ceiling; logout and revocation take effect immediately.
- Each session is one device. Signed-in devices are listed under the profile and can be signed out individually or all at once.
- Platform admins are regular users with `platformRole` set to `ADMIN` or `SUPER_ADMIN`.
- Organization owners are represented by `OrganizationMember` rows with role `OWNER`.
- Invitations separate identity binding from delivery. Targeted Telegram invitations use Telegram OIDC `sub`. Claimable links are bearer credentials: the first authenticated account to open one claims it, and the claim is stamped with that account's strongest identity — its Telegram account if it has one, otherwise its confirmed email address. A confirmed email address counts as such an identity; an unconfirmed one never does.

See `docs/auth.md`, `docs/organization-approval-flow.md`, `docs/platform-admin.md`, and `docs/invitations.md` for the full business and technical workflow, and `docs/deployment.md` for environment variables.

## Scripts

- `pnpm dev` starts all dev servers through Turbo.
- `pnpm build` builds all apps and packages.
- `pnpm lint` runs lint tasks.
- `pnpm typecheck` runs strict TypeScript checks.
- `pnpm admin:bootstrap` creates a short-lived one-time Telegram bootstrap for the first `SUPER_ADMIN`.
- `pnpm db:generate` generates Prisma Client.
- `pnpm db:migrate` runs Prisma migrations.
- `pnpm db:studio` opens Prisma Studio.

## Security Notes

- Browser auth is prepared for httpOnly cookies. Do not add localStorage token storage.
- Session tokens are opaque and carry nothing; organization permissions must be checked through database membership state. Runtime RLS context is not wired yet.
- Session tokens must be stored only as hashes.
- Six-digit sign-in codes are stored under scrypt, not a plain digest. Their entropy is too low to survive one.
- Passkey public keys and sign counters live in `auth_accounts`; WebAuthn challenges are stored hashed and consumed once.
- S3/R2 credentials must stay server-side.
- Private CRM/member data must not be joined into public website queries.
