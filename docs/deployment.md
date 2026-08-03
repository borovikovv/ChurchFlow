# Deployment

ChurchFlow deploys to a single Hetzner host with Docker Compose. Caddy runs on the host as a systemd service and terminates TLS outside Docker.

The deployment flow is intentionally manual and runs from one GitHub Actions workflow:

1. Choose the branch or tag in GitHub Actions under `Use workflow from`.
2. Run `Deploy` with the target GitHub Environment.
3. The workflow builds, publishes, migrates, deploys, and health-checks the exact `github.sha` selected by GitHub.

Images are always deployed by immutable commit SHA tags. Do not deploy `latest`.

## Runtime Shape

- `apps/api` runs as `churchflow-stage-api` or `churchflow-production-api` on container port `4000`.
- `apps/web` runs as `churchflow-stage-web` or `churchflow-production-web` on container port `3000`.
- `churchflow-api-migrator` is a one-shot container that runs `prisma migrate deploy` before API/Web are updated.
- PostgreSQL is managed separately and must already run as `churchflow-postgres`.
- API, Web, migrator, and `churchflow-postgres` share the external Docker network `churchflow-internal`.
- PostgreSQL is not published by the app Compose file.

Caddy should proxy to host-local ports:

| Environment | Web upstream     | API upstream     |
| ----------- | ---------------- | ---------------- |
| `stage`     | `127.0.0.1:3000` | `127.0.0.1:4000` |
| `prod`      | `127.0.0.1:3100` | `127.0.0.1:4100` |

The Compose file binds only to `127.0.0.1`, so no app container port is exposed directly to the internet.

## Compose Files

Repository files:

- `deploy/compose.yaml`
- `deploy/.env.example`
- `deploy/api.env.example`
- `deploy/web.env.example`

The GitHub deployment workflow uploads `deploy/compose.yaml` and renders these runtime files on the server:

- `/opt/churchflow/stage/.env`, `api.env`, and `web.env`
- `/opt/churchflow/production/.env`, `api.env`, and `web.env`

Do not commit real `.env`, `api.env`, or `web.env` files.

## Server Bootstrap

Run once on the Hetzner host as the deployment user:

```bash
sudo install -d -m 700 -o "$USER" -g "$USER" /opt/churchflow/stage
sudo install -d -m 700 -o "$USER" -g "$USER" /opt/churchflow/production
docker compose version
docker ps --filter name=churchflow-postgres
docker network inspect churchflow-internal >/dev/null 2>&1 || docker network create churchflow-internal
docker network inspect --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' churchflow-internal | grep -Fxq churchflow-postgres || docker network connect churchflow-internal churchflow-postgres
```

The deploy workflow repeats the network creation and `churchflow-postgres` attachment idempotently before migrations. It does not stop PostgreSQL and does not touch PostgreSQL volumes.

To keep the network attachment after the PostgreSQL container is recreated, update `/opt/churchflow/postgres/compose.yaml` to join the same external network:

```yaml
services:
  postgres:
    container_name: churchflow-postgres
    networks:
      - default
      - churchflow-internal

networks:
  churchflow-internal:
    external: true
    name: churchflow-internal
```

Keep the existing volume definitions unchanged.

## Deploy

Run the `Deploy` workflow manually.

Inputs:

- `environment`: `stage` or `prod`.

The `prod` GitHub Environment deploys into the existing production runtime names and directory: `churchflow-production-*` and `/opt/churchflow/production`.

The workflow checks out `github.sha` from the selected `Use workflow from` ref and publishes:

- `ghcr.io/borovikovv/churchflow-api:<github.sha>`
- `ghcr.io/borovikovv/churchflow-api-migrator:<github.sha>`
- `ghcr.io/borovikovv/churchflow-web:<github.sha>`

The Web image embeds `NEXT_PUBLIC_WEB_URL`, `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, and `JWT_ACCESS_PUBLIC_KEY` at `next build` time. Build the Web image separately for each environment. `TELEGRAM_CLIENT_ID` is runtime-only and is rendered into the server env files, not built into an image.

Prod deploys accept only a `github.sha` reachable from `main` or exactly matching a `v*` release tag.

The workflow:

- builds and pushes the API, migrator, and Web images to GHCR with the immutable `github.sha` tag;
- uploads the Compose file and generated env files to `/opt/churchflow/stage` or `/opt/churchflow/production`;
- logs in to GHCR on the server through stdin;
- creates `churchflow-internal` if needed;
- connects `churchflow-postgres` to that network if needed;
- runs `docker compose run --rm migrator`;
- stops if migrations fail;
- runs `docker compose up -d --remove-orphans api web`;
- waits for container healthchecks;
- checks `http://127.0.0.1:<api-port>/v1/health` and `http://127.0.0.1:<web-port>/`;
- prints `docker compose ps`.

## GitHub Environment Variables

Create protected GitHub Environments named `stage` and `prod`. Use the same variable names in both; values differ by environment.

Required variables for `stage`:

- `NEXT_PUBLIC_WEB_URL=https://stage.mychurchflow.org`
- `NEXT_PUBLIC_API_URL=https://api-stage.mychurchflow.org/v1`
- `API_INTERNAL_URL=http://churchflow-stage-api:4000/v1`
- `WEB_APP_URL=https://stage.mychurchflow.org`
- `COOKIE_DOMAIN=.mychurchflow.org`
- `PLATFORM_ADMIN_EMAIL=<admin email>`
- `TELEGRAM_CLIENT_ID=<telegram OAuth client id>`
- `TELEGRAM_REDIRECT_URI=https://api-stage.mychurchflow.org/v1/auth/telegram/callback`
- `TELEGRAM_BOT_USERNAME=<bot username>`
- `TELEGRAM_WEBHOOK_URL=https://api-stage.mychurchflow.org/v1/telegram/webhook/<route-token>`
- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM=ChurchFlow <no-reply@mychurchflow.org>`
- `SMTP_HOST=`
- `SMTP_PORT=`
- `S3_ENDPOINT=<S3-compatible endpoint URL>`
- `S3_REGION=auto`
- `S3_BUCKET=churchflow-stage`

Required variables for `prod` use the production domains and ports:

- `NEXT_PUBLIC_WEB_URL=https://mychurchflow.org`
- `NEXT_PUBLIC_API_URL=https://api.mychurchflow.org/v1`
- `API_INTERNAL_URL=http://churchflow-production-api:4000/v1`
- `WEB_APP_URL=https://mychurchflow.org`
- `COOKIE_DOMAIN=.mychurchflow.org`
- the production equivalents of the remaining variables above.

`API_INTERNAL_URL` is a Docker-network URL used by Next.js server code and rewrites. Do not use `localhost` for it inside containers.

## GitHub Environment Secrets

Use Environment-scoped secrets with the same names for `stage` and `prod`.

Required deployment secrets:

- `SSH_HOST`
- `SSH_USER`
- `SSH_PRIVATE_KEY`

Required API/runtime secrets:

- `DATABASE_URL`, using the Docker network hostname, for example `postgresql://churchflow:<password>@churchflow-postgres:5432/churchflow?schema=public`
- `JWT_ACCESS_PUBLIC_KEY`
- `JWT_ACCESS_PRIVATE_KEY`
- `JWT_REFRESH_PUBLIC_KEY`
- `JWT_REFRESH_PRIVATE_KEY`
- `TELEGRAM_CLIENT_SECRET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Optional Telegram bot secrets, required when bot notifications or webhooks are enabled:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

Required when `EMAIL_PROVIDER=resend`:

- `RESEND_API_KEY`

Required when `EMAIL_PROVIDER=smtp`:

- set variables `SMTP_HOST` and `SMTP_PORT`.

JWT PEM secrets may be stored with real newlines, escaped `\n`, or double-escaped `\\n`; the shared env schema normalizes all supported forms. The workflow writes PEM values into env files with escaped newlines so Compose does not need multiline env syntax.

Do not pass private JWT keys, database credentials, Telegram credentials, Resend API keys, or S3/R2 credentials to Docker builds. Only runtime env files receive them.

## First Stage Deployment

1. Confirm Caddy proxies:
   - `stage.mychurchflow.org` -> `127.0.0.1:3000`
   - `api-stage.mychurchflow.org` -> `127.0.0.1:4000`
2. Confirm `churchflow-postgres` is running:
   ```bash
   docker ps --filter name=churchflow-postgres
   ```
3. Confirm the shared network:
   ```bash
   docker network inspect churchflow-internal >/dev/null 2>&1 || docker network create churchflow-internal
   docker network connect churchflow-internal churchflow-postgres || true
   ```
   The second command may report that the endpoint already exists; that is fine.
4. Run `Deploy` from the stage branch or tag with:
   - `environment=stage`
5. Verify from the server:
   ```bash
   cd /opt/churchflow/stage
   docker compose --env-file .env -f compose.yaml ps
   curl --fail http://127.0.0.1:4000/v1/health
   curl --fail http://127.0.0.1:3000/
   ```
6. Verify externally:
   ```bash
   curl --fail https://api-stage.mychurchflow.org/v1/health
   curl --fail https://stage.mychurchflow.org/
   ```

## Production Deployment

1. Run `Deploy` from `main` or a `v*` release tag with `environment=prod`.
2. Confirm the workflow summary lists the expected `github.sha`.
3. Verify Caddy proxies:
   - production Web -> `127.0.0.1:3100`
   - production API -> `127.0.0.1:4100`

Stage and prod can share `churchflow-internal` because their service aliases are environment-specific: `churchflow-stage-api` and `churchflow-production-api`.

## Health Checks

API healthcheck:

```bash
curl --fail http://127.0.0.1:4000/v1/health
```

Web healthcheck:

```bash
curl --fail http://127.0.0.1:3000/
```

Use ports `4100` and `3100` for production.

The Next.js standalone runner is configured with `HOSTNAME=0.0.0.0` and `PORT=3000`. The Nest API listens on `PORT=4000`; Nest binds to all interfaces unless a host is explicitly supplied, and this app does not supply one.

## Rollback

Run `Deploy` again from a branch or tag pointing at the previous known-good commit SHA. The workflow rebuilds and republishes that immutable image set, then restarts API/Web after running idempotent Prisma deploy migrations.

Rollback cannot undo a migration that has already changed the database. If a migration is not backward-compatible, restore from a database backup or deploy a forward-fix migration.

## Failed Migration Recovery

If the migrator fails, the workflow stops before `docker compose up -d`. The currently running API/Web containers remain on the previous image tag.

On the server:

```bash
cd /opt/churchflow/<environment>
docker compose --env-file .env -f compose.yaml ps
docker compose --env-file .env -f compose.yaml --profile migrations run --rm --no-deps migrator
docker exec churchflow-postgres pg_isready -U churchflow -d churchflow
```

Inspect the failed migration and fix it with a new commit. Do not manually edit Prisma migration history unless you have a tested recovery plan and a database backup.

## Safe Diagnostics

```bash
cd /opt/churchflow/<environment>
docker compose --env-file .env -f compose.yaml config
docker compose --env-file .env -f compose.yaml ps
docker compose --env-file .env -f compose.yaml logs --tail=120 api web
docker inspect --format='{{json .State.Health}}' churchflow-stage-api
docker inspect --format='{{json .State.Health}}' churchflow-stage-web
docker inspect --format='{{json .State.Health}}' churchflow-production-api
docker inspect --format='{{json .State.Health}}' churchflow-production-web
docker network inspect --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}' churchflow-internal
docker exec churchflow-postgres pg_isready -U churchflow -d churchflow
docker image ls 'ghcr.io/*/churchflow-*'
```

Avoid `docker system prune`, deleting PostgreSQL volumes, stopping `churchflow-postgres`, publishing PostgreSQL on `0.0.0.0`, or changing Caddy during app deployment diagnostics.
