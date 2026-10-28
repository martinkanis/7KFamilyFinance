# Jeden kontejner: API (Elysia) servíruje i sestavený web. Build z kořene repa.
FROM oven/bun:1.2.23-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile

COPY apps/ apps/
RUN cd apps/web && bun run build
RUN cd apps/api && bun run build

FROM oven/bun:1.2.23-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/drizzle ./drizzle
COPY --from=builder /app/apps/web/dist ./public

ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_DIR=/app/public \
    MIGRATIONS_DIR=/app/drizzle

USER bun
EXPOSE 3000
CMD ["bun", "run", "dist/index.js"]
