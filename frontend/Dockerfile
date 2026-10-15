# ---------------------------------------------------------------------------
# Suporte Skills - Web (SPA React servida pelo nginx, com proxy para a API)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Modulo Tickets (D-029): a SPA so' mostra Clientes/Tickets/Medicoes se compilada
# com a flag ligada. Passe --build-arg VITE_TICKETS_ENABLED=true no release.
ARG VITE_TICKETS_ENABLED=false
ENV VITE_TICKETS_ENABLED=$VITE_TICKETS_ENABLED

# Ambiente (PRD/HML/DEV) exibido na interface (D-038).
ARG VITE_APP_ENVIRONMENT=DEV
ENV VITE_APP_ENVIRONMENT=$VITE_APP_ENVIRONMENT

RUN npm run build

# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
