# syntax=docker/dockerfile:1.7
#
# Self-contained Dockerfile for the @offerkit/worker service.
# Build context is the repo root.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

# ---------- deps: install workspace deps from lockfile ----------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
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

# ---------- runtime ----------
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Re-run install to wire up workspace symlinks for the just-copied source.
RUN pnpm install --frozen-lockfile --offline
EXPOSE 9091
CMD ["pnpm", "--filter", "@offerkit/worker", "start"]
