# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM dependencies AS builder

ARG NEXT_PUBLIC_WEB_URL
ARG NEXT_PUBLIC_API_URL
ARG API_INTERNAL_URL

ENV NODE_ENV=production
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV API_INTERNAL_URL=$API_INTERNAL_URL

COPY apps/web apps/web
COPY packages packages

RUN pnpm --filter @churchflow/web... build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

RUN groupadd --system --gid 1001 churchflow \
  && useradd --system --uid 1001 --gid churchflow churchflow

COPY --from=builder --chown=churchflow:churchflow /app/apps/web/.next/standalone ./
COPY --from=builder --chown=churchflow:churchflow /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=churchflow:churchflow /app/apps/web/public ./apps/web/public

USER churchflow

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
