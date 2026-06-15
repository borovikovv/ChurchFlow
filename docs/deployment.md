# Deployment

## Services

- Deploy `apps/web` as a Next.js application.
- Deploy `apps/api` as a Node.js service.
- Use managed PostgreSQL. Apply the RLS foundation when testing or enabling database-level tenant policies.
- Use S3-compatible object storage such as Cloudflare R2 or AWS S3.

## Required Secrets

- `DATABASE_URL`
- JWT access key pair
- JWT refresh key pair env vars are currently required by config, but refresh tokens are opaque random strings stored as hashes rather than signed JWTs
- S3/R2 endpoint, bucket, region, access key, and secret
- Web/API public URLs and cookie domain

## Production Checklist

- Replace all placeholder keys.
- Enforce TLS.
- Configure secure, httpOnly, SameSite cookies.
- Apply generated Prisma migrations.
- Apply RLS SQL and verify policies with least-privileged DB roles before relying on database-level enforcement.
- Configure structured logging and request ids.
- Configure rate limits for auth and public contact flows.
- Promote the first platform admin with `pnpm admin:promote`; do not add public bootstrap endpoints.
