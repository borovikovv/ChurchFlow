# Deployment

## Services

- Deploy `apps/web` as a Next.js application.
- Deploy `apps/api` as a Node.js service.
- Use managed PostgreSQL. Apply the RLS foundation when testing or enabling database-level tenant policies.
- Use S3-compatible object storage such as Cloudflare R2 or AWS S3.

## Required Secrets

- API: `DATABASE_URL`, `WEB_APP_URL`, Telegram OIDC credentials, email credentials, and S3/R2 credentials
- Web build/runtime: `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_API_URL`, and `API_INTERNAL_URL`
- JWT access key pair
- JWT refresh key pair env vars are currently required by config, but refresh tokens are opaque random strings stored as hashes rather than signed JWTs
- S3/R2 endpoint, bucket, region, access key, and secret
- Cookie domain when Web and API need a shared parent-domain cookie

## Production Checklist

- Replace all placeholder keys.
- Enforce TLS.
- Configure secure, httpOnly, SameSite cookies.
- Apply generated Prisma migrations.
- Apply RLS SQL and verify policies with least-privileged DB roles before relying on database-level enforcement.
- Configure structured logging and request ids.
- Configure rate limits for auth and public contact flows.
- Create the first platform admin with `pnpm admin:bootstrap` from a protected interactive shell. The generated claim is single-use, short-lived, Telegram-verified, and disabled after the first active `SUPER_ADMIN` exists. The CLI refuses CI execution to avoid leaking the URL into job logs.
- Build Web separately for each environment because `NEXT_PUBLIC_*` values are embedded at build time.

See `docs/environment.md` for exact environment ownership and deployment requirements.
