# Deployment

## Services

- Deploy `apps/web` as a Next.js application.
- Deploy `apps/api` as a Node.js service.
- Use managed PostgreSQL with RLS enabled.
- Use S3-compatible object storage such as Cloudflare R2 or AWS S3.

## Required Secrets

- `DATABASE_URL`
- JWT access and refresh key pairs
- S3/R2 endpoint, bucket, region, access key, and secret
- Web/API public URLs and cookie domain

## Production Checklist

- Replace all placeholder keys.
- Enforce TLS.
- Configure secure, httpOnly, SameSite cookies.
- Apply generated Prisma migrations.
- Apply RLS SQL and verify policies with least-privileged DB roles.
- Configure structured logging and request ids.
- Configure rate limits for auth and public contact flows.
