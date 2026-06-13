# syntax=docker/dockerfile:1.7
#
# Canonical OfferKit runtime image.
# The same image runs the web service by default and the worker service when
# started with: node apps/worker/dist/index.js

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.23.0 --activate
WORKDIR /app

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
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Re-run install to wire up workspace symlinks for the just-copied source.
RUN --mount=type=cache,target=/pnpm/store pnpm install --frozen-lockfile --offline --ignore-scripts
RUN pnpm --filter @offerkit/worker build
RUN --mount=type=cache,target=/app/apps/web/.next/cache pnpm --filter @offerkit/web build

FROM builder AS worker-prod-deps
RUN --mount=type=cache,target=/pnpm/store pnpm --filter @offerkit/worker deploy --prod --legacy --ignore-scripts /prod/worker

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=worker-prod-deps /prod/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle
RUN node -e "require('node:fs').writeFileSync('package.json', JSON.stringify({ scripts: { start: 'node apps/web/server.js', worker: 'node apps/worker/dist/index.js' } }, null, 2) + '\n')"

EXPOSE 3000 9091
CMD ["node", "apps/web/server.js"]
