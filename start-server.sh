#!/bin/bash
set -e

if [ ! -d "node_modules" ]; then
  echo "==> Installing dependencies (bun)..."
  SKIP_NASTECH_WIRE_BUILD=1 bun install

  echo "==> Building @nastech-ai/nastech-wire..."
  cd packages/nastech-wire && bun run build && cd ../..

  echo "==> Running Prisma generate..."
  cd packages/nastech-server && bunx prisma generate --schema=prisma/schema.prisma && cd ../..
else
  echo "==> Dependencies already installed, skipping..."
fi

# Require NASTECH_MASTER_SECRET from environment
if [ -z "$NASTECH_MASTER_SECRET" ]; then
  echo "ERROR: NASTECH_MASTER_SECRET environment variable is required." >&2
  exit 1
fi

echo "==> Migrating database (PostgreSQL)..."
cd packages/nastech-server && DATABASE_URL="$DATABASE_URL" bunx prisma migrate deploy --schema=prisma/schema.prisma && cd ../..

echo "==> Starting NasTech server on port 5000..."
PORT=5000 DB_PROVIDER=postgres DATABASE_URL="$DATABASE_URL" NASTECH_MASTER_SECRET="$NASTECH_MASTER_SECRET" bun run packages/nastech-server/sources/standalone.ts serve
