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

FROM dependencies AS migrator

ENV NODE_ENV=production
ENV HOME=/tmp
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

WORKDIR /app

COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts

RUN set -eux; \
  pnpm --filter @churchflow/db db:generate; \
  generated_client="$(find /app -path '*/node_modules/.prisma/client/default.js' -print -quit)"; \
  test -n "$generated_client"; \
  node -e "const db = require(process.argv[1]); if (typeof db.PrismaClient !== 'function') throw new Error('PrismaClient export missing');" "$generated_client"

RUN groupadd --system --gid 1001 churchflow \
  && useradd --system --uid 1001 --gid churchflow churchflow

USER churchflow

WORKDIR /app/packages/db

CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

RUN groupadd --system --gid 1001 churchflow \
  && useradd --system --uid 1001 --gid churchflow churchflow

COPY --from=builder --chown=churchflow:churchflow /runtime/api ./

RUN node -e "const db = require('@churchflow/db'); if (typeof db.PrismaClient !== 'function') throw new Error('PrismaClient export missing');"

USER churchflow

EXPOSE 4000

CMD ["node", "dist/main.js"]
