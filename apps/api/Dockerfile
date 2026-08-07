# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable \
  && corepack prepare pnpm@9.15.0 --activate

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @churchflow/db db:generate
RUN pnpm --filter @churchflow/api... build
RUN pnpm --filter @churchflow/api --prod deploy /runtime/api
RUN set -eux; \
  generated_client="$(find node_modules/.pnpm -path '*/node_modules/.prisma/client/default.js' -print -quit)"; \
  test -n "$generated_client"; \
  generated_client_dir="$(dirname "$generated_client")"; \
  deployed_clients="$(find /runtime/api/node_modules/.pnpm -path '*/node_modules/@prisma/client/default.js' -print)"; \
  test -n "$deployed_clients"; \
  for prisma_client_default in $deployed_clients; do \
    deployed_node_modules="$(dirname "$(dirname "$(dirname "$prisma_client_default")")")"; \
    rm -rf "$deployed_node_modules/.prisma/client"; \
    mkdir -p "$deployed_node_modules/.prisma"; \
    cp -a "$generated_client_dir" "$deployed_node_modules/.prisma/client"; \
  done; \
  cd /runtime/api; \
  node -e "const db = require('@churchflow/db'); if (typeof db.PrismaClient !== 'function') throw new Error('PrismaClient export missing');"

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=4000
ENV HOME=/tmp

WORKDIR /app

RUN groupadd --system --gid 1001 churchflow \
  && useradd --system --uid 1001 --gid churchflow churchflow

COPY --from=builder --chown=churchflow:churchflow /runtime/api ./
COPY --from=builder --chown=churchflow:churchflow /app/packages/db/prisma packages/db/prisma
COPY --from=builder --chown=churchflow:churchflow /app/packages/db/prisma.config.ts packages/db/prisma.config.ts

RUN set -eux; \
  node -e "const db = require('@churchflow/db'); if (typeof db.PrismaClient !== 'function') throw new Error('PrismaClient export missing');"; \
  test -f packages/db/prisma.config.ts; \
  test -f packages/db/prisma/schema.prisma; \
  test -d packages/db/prisma/migrations; \
  test -n "$(find packages/db/prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -print -quit)"; \
  prisma_cli="$(find node_modules -path '*/node_modules/prisma/build/index.js' -print -quit)"; \
  test -n "$prisma_cli"; \
  node "$prisma_cli" --version >/dev/null; \
  { \
    printf '%s\n' '#!/bin/sh'; \
    printf '%s\n' 'set -eu'; \
    printf '%s\n' 'prisma_cli="$(find node_modules -path '\''*/node_modules/prisma/build/index.js'\'' -print -quit)"'; \
    printf '%s\n' 'if [ -z "$prisma_cli" ]; then'; \
    printf '%s\n' '  echo "Prisma CLI was not found in the API image." >&2'; \
    printf '%s\n' '  exit 1'; \
    printf '%s\n' 'fi'; \
    printf '%s\n' 'prisma_cli="$(pwd)/$prisma_cli"'; \
    printf '%s\n' 'cd packages/db'; \
    printf '%s\n' 'exec node "$prisma_cli" --config prisma.config.ts migrate deploy "$@"'; \
  } > /usr/local/bin/churchflow-prisma-migrate-deploy; \
  chmod 755 /usr/local/bin/churchflow-prisma-migrate-deploy; \
  DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" /usr/local/bin/churchflow-prisma-migrate-deploy --help >/dev/null

USER churchflow

EXPOSE 4000

CMD ["node", "dist/main.js"]
