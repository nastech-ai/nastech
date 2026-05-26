#!/bin/bash
set -e

if [ ! -d "node_modules" ]; then
  echo "==> Installing dependencies (bun)..."
  SKIP_NASTECH_WIRE_BUILD=1 bun install

  echo "==> Building @nastech-ai/nastech-wire..."
  cd packages/happy-wire && bun run build && cd ../..

  echo "==> Running Prisma generate..."
  cd packages/happy-server && bunx prisma generate --schema=prisma/schema.prisma && cd ../..
else
  echo "==> Dependencies already installed, skipping..."
fi

echo "==> Migrating database..."
PORT=5000 DB_PROVIDER=pglite NASTECH_MASTER_SECRET=nastech-dev-secret-key bun run packages/happy-server/sources/standalone.ts migrate

echo "==> Starting NasTech server on port 5000..."
PORT=5000 DB_PROVIDER=pglite NASTECH_MASTER_SECRET=nastech-dev-secret-key bun run packages/happy-server/sources/standalone.ts serve
