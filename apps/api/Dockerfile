# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @churchflow/api... build
RUN pnpm --filter @churchflow/api --prod deploy /runtime/api

FROM dependencies AS migrator

ENV NODE_ENV=production

WORKDIR /app

COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma.config.ts packages/db/prisma.config.ts

WORKDIR /app/packages/db

CMD ["pnpm", "db:migrate:deploy"]

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=4000

WORKDIR /app

RUN groupadd --system --gid 1001 churchflow \
  && useradd --system --uid 1001 --gid churchflow churchflow

COPY --from=builder --chown=churchflow:churchflow /runtime/api ./

USER churchflow

EXPOSE 4000

CMD ["node", "dist/main.js"]
