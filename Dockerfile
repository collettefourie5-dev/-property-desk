# syntax=docker/dockerfile:1

# Multi-stage build. No secrets are ever ARG/ENV'd into this image — the app validates
# and reads its real configuration from the environment at container start (src/lib/env.ts,
# src/instrumentation.ts), never at build time. Only non-secret version metadata is baked in.

FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- deps: install dependencies deterministically (postinstall runs `prisma generate`) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# ---- builder: compile the Next.js app ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: minimal production image ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ARG APP_VERSION=0.0.0
ARG GIT_COMMIT=unknown
ARG GIT_TAG=unknown
ARG BUILD_TIME=unknown
ENV APP_VERSION=$APP_VERSION
ENV GIT_COMMIT=$GIT_COMMIT
ENV GIT_TAG=$GIT_TAG
ENV BUILD_TIME=$BUILD_TIME

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# server.js (from `output: 'standalone'`) already handles SIGTERM for graceful shutdown.
CMD ["node", "server.js"]
