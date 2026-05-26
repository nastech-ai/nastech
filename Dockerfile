# Standalone nastech-server: single container, no external dependencies
# Uses PGlite (embedded Postgres), local filesystem storage, no Redis

# Stage 1: install dependencies
FROM node:20 AS deps

RUN apt-get update && apt-get install -y python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY scripts ./scripts
COPY patches ./patches

RUN mkdir -p packages/nastech-app packages/nastech-server packages/nastech-cli packages/nastech-agent packages/nastech-wire

COPY packages/nastech-app/package.json packages/nastech-app/
COPY packages/nastech-server/package.json packages/nastech-server/
COPY packages/nastech-cli/package.json packages/nastech-cli/
COPY packages/nastech-agent/package.json packages/nastech-agent/
COPY packages/nastech-wire/package.json packages/nastech-wire/

# Workspace postinstall requirements
COPY packages/nastech-app/patches packages/nastech-app/patches
COPY packages/nastech-server/prisma packages/nastech-server/prisma
COPY packages/nastech-cli/scripts packages/nastech-cli/scripts
COPY packages/nastech-cli/tools packages/nastech-cli/tools

RUN SKIP_HAPPY_WIRE_BUILD=1 pnpm install --frozen-lockfile

# Stage 2: copy source and type-check
FROM deps AS builder

COPY packages/nastech-wire ./packages/nastech-wire
COPY packages/nastech-server ./packages/nastech-server

RUN pnpm --filter @nastech-ai/nastech-wire build
RUN pnpm --filter nastech-server-self-host build

# Stage 3: runtime
FROM node:20-slim AS runner

WORKDIR /repo

RUN apt-get update && apt-get install -y ffmpeg curl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV DATA_DIR=/data
ENV PGLITE_DIR=/data/pglite

COPY --from=builder /repo/node_modules /repo/node_modules
COPY --from=builder /repo/packages/nastech-wire /repo/packages/nastech-wire
COPY --from=builder /repo/packages/nastech-server /repo/packages/nastech-server

VOLUME /data
EXPOSE 3005

WORKDIR /repo/packages/nastech-server

CMD ["sh", "-c", "../../node_modules/.bin/tsx sources/standalone.ts migrate && exec ../../node_modules/.bin/tsx sources/standalone.ts serve"]
