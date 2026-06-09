# ADR 0001: Monorepo

## Status

Accepted

## Decision

Use a pnpm workspace with Turborepo. Keep deployable applications in `apps/*` and reusable packages in `packages/*`.

## Consequences

Shared types, schemas, Prisma access, and config can evolve consistently. Application boundaries remain explicit and deployable independently.
