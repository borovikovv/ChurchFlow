# API application agent instructions

These rules apply to code under `apps/api` in addition to the repository-level instructions.

## Architecture

- Keep controllers thin: validate transport input, call services, and return results.
- Put authorization and business rules in services.
- Keep Prisma queries and persistence details in repositories.
- Use schemas and types from `@churchflow/shared` when data crosses application boundaries.
- Preserve soft-delete, membership status, and organization status filters in reads and counts.

## Data integrity

- Use transactions when a mutation updates multiple related records or audit logs.
- Record audit events for security-sensitive organization, membership, invitation, and role mutations.
- Never weaken ownership or organization-boundary checks for convenience.
- Add a migration for schema changes; do not edit generated Prisma client output.

## API behavior

- Filtering, search, sorting, and pagination for API-backed collections belong on the backend. Accept explicit validated query parameters and apply them in repository queries rather than returning full datasets for the frontend to filter.
- Return stable, explicit response shapes.
- Use NestJS HTTP exceptions for expected client-visible failures.
- Avoid leaking tokens, secrets, hashes, or internal errors in responses and logs.
- Keep invitation and claim tokens single-purpose, expiring, and revocable.

## Verification

- Run the API workspace typecheck after TypeScript changes.
- Run targeted ESLint and relevant tests for changed API modules.
