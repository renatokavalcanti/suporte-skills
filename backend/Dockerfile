# ---------------------------------------------------------------------------
# Suporte Skills - API (imagem de producao)
# Estagio unico de build + runtime. O runtime reaproveita o node_modules do
# build para permitir `prisma migrate deploy` e `npm run seed` no container.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY package.json package-lock.json ./

EXPOSE 4000
CMD ["node", "dist/main.js"]
