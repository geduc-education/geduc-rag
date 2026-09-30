# syntax=docker/dockerfile:1
# ==========================================================================
# geduc-rag — build reprodutível multi-stage (backend NestJS)
# Base Node 24. Sem segredos na imagem: config em runtime.
# ==========================================================================

# --------------------------------------------------------------------------
# Stage 1 — build. Não usar `--ignore-scripts`: o argon2 depende do install.
# --------------------------------------------------------------------------
FROM node:24-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --------------------------------------------------------------------------
# Stage 2 — runtime: só os artefatos.
# --------------------------------------------------------------------------
FROM node:24-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
# As migrations não rodam no arranque: aplique-as com `npm run db:migrate`
# (fora do container da aplicação) antes de subir uma versão nova.
EXPOSE 3000
CMD ["node", "dist/src/main"]
