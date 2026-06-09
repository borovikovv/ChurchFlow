# ADR 0002: RLS-First Authorization

## Status

Accepted

## Decision

PostgreSQL RLS is the final tenant authorization layer. API checks may improve ergonomics and error messages, but database policies must protect tenant-owned data.

## Consequences

JWTs carry identity and session references, not organization authorization truth. The API must bind authenticated user context to database transactions before tenant queries.
