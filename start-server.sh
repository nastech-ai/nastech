#!/bin/bash
set -e

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "==> Installing dependencies..."
  SKIP_NASTECH_WIRE_BUILD=1 bun install
fi

# Build nastech-wire if dist is missing
if [ ! -f "packages/nastech-wire/dist/index.cjs" ]; then
  echo "==> Building @nastech-ai/nastech-wire..."
  cd packages/nastech-wire && bun run build && cd ../..
fi

# Generate Prisma client if needed
if [ ! -d "node_modules/@prisma/client" ] || [ ! -f "node_modules/@prisma/client/default.js" ]; then
  echo "==> Running Prisma generate..."
  cd packages/nastech-server && bunx prisma generate --schema=prisma/schema.prisma && cd ../..
fi

# Require NASTECH_MASTER_SECRET from environment
if [ -z "$NASTECH_MASTER_SECRET" ]; then
  echo "ERROR: NASTECH_MASTER_SECRET environment variable is required." >&2
  exit 1
fi

echo "==> Migrating database..."
cd packages/nastech-server && DATABASE_URL="$DATABASE_URL" bunx prisma migrate deploy --schema=prisma/schema.prisma && cd ../..

echo "==> Starting NasTech server on port 5000..."
export PORT=5000
export DB_PROVIDER=postgres
exec bun run packages/nastech-server/sources/standalone.ts serve
