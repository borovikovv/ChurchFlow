# ADR 0002: RLS-First Authorization

## Status

Accepted as target architecture; partially implemented at runtime

## Decision

PostgreSQL RLS is the target final tenant authorization layer. API checks improve ergonomics and currently provide the active runtime authorization enforcement until Prisma request-scoped RLS context is implemented.

## Consequences

JWTs carry identity and session references, not organization authorization truth. The API must not trust JWTs for organization roles or permissions. Today, API guards and services check database membership state before tenant queries; the API must bind authenticated user context to database transactions before relying on RLS as the final layer.
