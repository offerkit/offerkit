# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

# ---------- deps stage: install workspace deps ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY turbo.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/config/package.json packages/config/
COPY packages/contract/package.json packages/contract/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/sdk/package.json packages/sdk/
COPY packages/cli/package.json packages/cli/
COPY packages/mcp/package.json packages/mcp/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ---------- builder stage: build the web app ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Re-run install to wire up workspace symlinks for the just-copied source.
RUN pnpm install --frozen-lockfile --offline
RUN pnpm --filter @open-voucherify/web build

# ---------- web runtime ----------
FROM node:24-alpine AS web
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# ---------- worker runtime ----------
FROM base AS worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install --frozen-lockfile --offline
EXPOSE 9091
CMD ["pnpm", "--filter", "@open-voucherify/worker", "start"]
