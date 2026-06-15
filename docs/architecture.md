# Architecture

ChurchFlow is a multi-tenant SaaS monorepo with separate deployable apps and shared packages.

## Boundaries

- `apps/web` contains the Next.js App Router UI and server components.
- `apps/api` contains the Nest.js API, modularized by business capability.
- `packages/db` owns Prisma schema, generated client access, and database security SQL.
- `packages/shared` owns stable TypeScript types, Zod schemas, constants, and env schemas.
- `packages/config` owns shared TypeScript and ESLint configuration.

## Tenancy

Tenant-owned resources include `organization_id` and are indexed for organization-scoped queries. The current runtime enforcement is explicit Nest guards and service checks against database membership state. PostgreSQL RLS helper functions and policies exist as a foundation, but Prisma request-scoped RLS context is not wired yet.

## Backend Layers

Nest modules follow controller, service, repository, dto boundaries. Controllers parse transport concerns, services enforce business flow, repositories own Prisma access, and DTOs are Zod-backed.

## Frontend Shape

The frontend uses route groups:

- `app/(public)` for public organization pages.
- `app/(auth)` for authentication surfaces.
- `app/(dashboard)` for tenant administration.

Server components fetch through `src/api/client.ts`, forwarding httpOnly cookies without exposing tokens to browser JavaScript.
