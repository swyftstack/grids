# syntax=docker/dockerfile:1

# ── Stage 1: build the frontend bundle and the web server ─────────────────────
# Node 24 ships a built-in SQLite (`node:sqlite`), used by the auth store — no native module needed.
FROM node:26-bookworm-slim AS builder
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
COPY apps/desktop/package.json apps/desktop/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy sources and build: core (JS), desktop frontend (Vite), web server (tsc).
COPY . .
RUN pnpm --filter @swyftgrid/core build \
 && pnpm --filter @swyftgrid/desktop exec vite build \
 && pnpm --filter @swyftgrid/web build

# Produce a pruned production dependency tree for the web app.
RUN pnpm --filter @swyftgrid/web deploy --prod /app/deploy

# ── Stage 2: minimal runtime ──────────────────────────────────────────────────
FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV SWYFTGRID_DATA_DIR=/data
ENV SWYFTGRID_STATIC_DIR=/app/public

WORKDIR /app
RUN useradd --system --uid 10001 swyftgrid && mkdir -p /data && chown swyftgrid /data

# Web server (with pruned node_modules) and the built frontend.
COPY --from=builder /app/deploy ./
COPY --from=builder /app/apps/desktop/dist ./public

# Operational CLI commands (run as: docker exec <container> reset-password, etc.).
RUN for cmd in reset-password reset-admin-password create-admin disable-auth enable-auth; do \
      printf '#!/bin/sh\nexec node /app/dist/cli.js %s "$@"\n' "$cmd" > /usr/local/bin/$cmd && \
      chmod +x /usr/local/bin/$cmd; \
    done

USER swyftgrid
VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
