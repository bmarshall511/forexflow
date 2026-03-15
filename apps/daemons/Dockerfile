# Multi-stage build for FXFlow daemon.
# Produces a minimal Node.js image with only production dependencies.

# ── Stage 1: Install dependencies and build ──────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable pnpm

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# Copy package.json files for dependency resolution
COPY packages/types/package.json packages/types/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY apps/daemons/package.json apps/daemons/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/ packages/
COPY apps/daemons/ apps/daemons/

# Generate Prisma client
RUN pnpm --filter @fxflow/db db:generate

# ── Stage 2: Production image ────────────────────────────────────────────────
FROM node:22-slim AS runner

RUN corepack enable pnpm

WORKDIR /app

# Copy built workspace
COPY --from=builder /app /app

# Remove dev dependencies to slim down
RUN pnpm prune --prod --no-optional 2>/dev/null || true

ENV NODE_ENV=production

# Railway assigns $PORT dynamically — daemon reads DAEMON_PORT
# If PORT is set (Railway), map it to DAEMON_PORT
CMD ["sh", "-c", "exec node --import tsx apps/daemons/src/index.ts"]

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:' + (process.env.DAEMON_PORT || '4100') + '/health/ready').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
