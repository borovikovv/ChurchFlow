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

## Stage Deployment On Hetzner

Stage is deployed manually from GitHub Actions to a single Hetzner host. The workflow never deploys on push. Caddy runs on the host OS and must proxy these public domains to localhost:

- `https://stage.mychurchflow.org` -> `127.0.0.1:3000`
- `https://api-stage.mychurchflow.org` -> `127.0.0.1:4000`

PostgreSQL is not managed by the stage Compose project. The existing `churchflow-postgres` container must keep publishing PostgreSQL on `127.0.0.1:5432`. Stage API and migration containers reach PostgreSQL through the external Docker network `churchflow-internal` using the hostname `churchflow-postgres`.

### One-Time Server Setup

Run these once on the Hetzner server as the deployment user:

```bash
sudo install -d -m 700 -o "$USER" -g "$USER" /opt/churchflow/stage
docker compose version
docker ps --filter name=churchflow-postgres
docker network inspect churchflow-internal >/dev/null 2>&1 || docker network create churchflow-internal
docker network inspect --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' churchflow-internal | grep -Fxq churchflow-postgres || docker network connect churchflow-internal churchflow-postgres
```

The deploy workflow also runs the network setup idempotently before migrations. Do not change `/opt/churchflow/postgres`, stop `churchflow-postgres`, publish PostgreSQL on `0.0.0.0`, or prune Docker images as part of stage setup.

### GitHub Environment `stage`

Create a protected GitHub Environment named `stage`.

Required secrets:

- `STAGE_SSH_HOST`
- `STAGE_SSH_USER`
- `STAGE_SSH_PRIVATE_KEY`
- `STAGE_GHCR_TOKEN` only when the default workflow token cannot pull GHCR packages from the server
- `STAGE_DATABASE_URL`, using the external Docker network hostname, for example `postgresql://churchflow:<password>@churchflow-postgres:5432/churchflow?schema=public`
- `JWT_ACCESS_PUBLIC_KEY`
- `JWT_ACCESS_PRIVATE_KEY`
- `JWT_REFRESH_PUBLIC_KEY`
- `JWT_REFRESH_PRIVATE_KEY`
- `TELEGRAM_CLIENT_ID`
- `TELEGRAM_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `RESEND_API_KEY` when `EMAIL_PROVIDER=resend`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Required variables:

- `NEXT_PUBLIC_WEB_URL=https://stage.mychurchflow.org`
- `NEXT_PUBLIC_API_URL=https://api-stage.mychurchflow.org/v1`
- `API_INTERNAL_URL=http://churchflow-stage-api:4000/v1`
- `WEB_APP_URL=https://stage.mychurchflow.org`
- `COOKIE_DOMAIN=.mychurchflow.org`
- `PLATFORM_ADMIN_EMAIL=<admin email>`
- `TELEGRAM_REDIRECT_URI=https://api-stage.mychurchflow.org/v1/auth/telegram/callback`
- `TELEGRAM_BOT_USERNAME=<bot username>`
- `TELEGRAM_WEBHOOK_URL=https://api-stage.mychurchflow.org/v1/telegram/webhook/<webhook secret or route token>`
- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM=ChurchFlow <no-reply@mychurchflow.org>`
- `SMTP_HOST=` when not using SMTP
- `SMTP_PORT=` when not using SMTP
- `S3_ENDPOINT=<S3-compatible endpoint URL>`
- `S3_REGION=auto`
- `S3_BUCKET=churchflow-stage`

`NEXT_PUBLIC_*` values are embedded into the Next.js image at build time, so build the image with the `stage` environment before deploying it to stage. The web service receives only `NODE_ENV`, `PORT`, `HOSTNAME`, `API_INTERNAL_URL`, `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_API_URL`, `JWT_ACCESS_PUBLIC_KEY`, and `COOKIE_DOMAIN` at runtime. API secrets are written to `/opt/churchflow/stage/api.env` and are not passed to the web service.

### First Deployment

1. Run the `Build deployment images` workflow.
2. Use `git_ref=stage`.
3. Use `environment=stage`.
4. Copy the resolved commit SHA from the workflow output or image tags.
5. Run the `Deploy stage` workflow with `image_tag=<40-character-commit-sha>`.

The deployment workflow accepts only full Git commit SHA tags, verifies the API, web, and migrator images exist in GHCR, uploads only `deploy/stage/compose.yaml`, a generated `.env`, and a generated `api.env` to `/opt/churchflow/stage`, logs in to GHCR on the server through stdin, creates `churchflow-internal` if needed, attaches `churchflow-postgres` if needed, runs Prisma migrations with `churchflow-api-migrator:<sha>`, starts the API and web services, and fails if either container does not become healthy.

### Repeat Deployment

Build images for the new commit with the `stage` environment, then run `Deploy stage` with the new commit SHA. There is no automatic deployment after push.

### Health Checks

On the server:

```bash
cd /opt/churchflow/stage
docker compose --env-file .env -f compose.yaml ps
docker network inspect --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' churchflow-internal
curl --fail http://127.0.0.1:4000/v1/health
curl --fail http://127.0.0.1:3000/
```

From outside the server:

```bash
curl --fail https://api-stage.mychurchflow.org/v1/health
curl --fail https://stage.mychurchflow.org/
```

### Rollback

Run `Deploy stage` again with the previous known-good image tag. The workflow reuses the same Compose file, pulls that immutable API/web/migrator image set, runs idempotent Prisma deploy migrations, and restarts the two stage services.

### Safe Diagnostics

```bash
cd /opt/churchflow/stage
docker compose --env-file .env -f compose.yaml config
docker compose --env-file .env -f compose.yaml ps
docker compose --env-file .env -f compose.yaml logs --tail=120 api web
docker inspect --format='{{json .State.Health}}' churchflow-stage-api
docker inspect --format='{{json .State.Health}}' churchflow-stage-web
docker network inspect --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' churchflow-internal
docker exec churchflow-postgres pg_isready -U churchflow -d churchflow
docker image ls 'ghcr.io/*/churchflow-*'
```

Avoid `docker system prune`, deleting PostgreSQL volumes, stopping `churchflow-postgres`, or modifying `/opt/churchflow/postgres` during stage diagnostics.
