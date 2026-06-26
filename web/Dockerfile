# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Frontend (Next.js 16, standalone output).
# NEXT_PUBLIC_* values are baked in at build time, so they are build args.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
# Same-origin API in production: the browser calls /api and /api/socket.io,
# which Nginx proxies to the backend. Override via build args if needed.
ARG NEXT_PUBLIC_API_URL=/api
ARG NEXT_PUBLIC_SOCKET_PATH=/api/socket.io
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_PATH=$NEXT_PUBLIC_SOCKET_PATH
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005
ENV HOSTNAME=0.0.0.0
RUN apk add --no-cache tini wget
# Standalone bundle: server.js + minimal node_modules, plus static assets.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# public/ is optional; copy if present (kept commented to avoid build failure).
# COPY --from=builder /app/public ./public
USER node
EXPOSE 3005
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
