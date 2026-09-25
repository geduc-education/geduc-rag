# syntax=docker/dockerfile:1
# ==========================================================================
# geduc-rag — build reprodutível multi-stage (backend NestJS)
# Base Node 24. Sem segredos na imagem: config em runtime.
# ==========================================================================

# --------------------------------------------------------------------------
# Stage 1 — build: o postinstall (`prisma generate`) exige schema + config
# ANTES do `npm ci`. Não usar `--ignore-scripts`: o argon2 depende do install.
# --------------------------------------------------------------------------
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

# --------------------------------------------------------------------------
# Stage 2 — runtime: só os artefatos. OpenSSL p/ o Prisma.
# --------------------------------------------------------------------------
FROM node:24-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# Schema/config p/ `prisma migrate deploy` no arranque.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
EXPOSE 3000
CMD ["node", "dist/src/main"]
