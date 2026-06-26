# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Backend API (Fastify + Socket.io, TypeScript ESM run via tsx).
# Multi-stage: install deps in a builder, copy a pruned tree into a slim
# runtime image that runs as a non-root user.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
# Only the manifests first, so the dependency layer is cached across code changes.
COPY package.json package-lock.json ./
# tsx is a devDependency but is the production runtime here, so install all deps.
RUN npm ci

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Tini gives us proper PID 1 signal handling (clean Ctrl-C / docker stop).
RUN apk add --no-cache tini wget
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
# Drop privileges: the bundled "node" user owns nothing it shouldn't.
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
# migrate() runs automatically on boot (see src/server/index.ts).
CMD ["node", "--import", "tsx", "src/server/index.ts"]
