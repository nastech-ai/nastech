# NasTech

AI agent coordination and deployment platform. Connects mobile/web clients with remote AI agents (Claude Code, Codex, etc.) over secure, encrypted real-time WebSocket connections.

## Project Structure

- `packages/nastech-server` — Fastify backend (Socket.IO, Prisma, PostgreSQL)
- `packages/nastech-app` — Expo/React Native mobile + web app
- `packages/nastech-cli` — CLI tool for local agent execution
- `packages/nastech-wire` — Shared TypeScript/Zod types used across all packages
- `packages/codium` — Electron-based desktop IDE for AI agents
- `packages/nastech-agent` — CLI client for remote agent control
- `packages/nastech-app-logs` — App log capture utility

## Running the Project

The **NasTech Server** workflow starts the backend on port 5000 via `start-server.sh`.

On startup it:
1. Installs dependencies (bun) if needed
2. Builds `nastech-wire` if dist is missing
3. Generates Prisma client if needed
4. Runs `prisma migrate deploy` against the PostgreSQL database
5. Starts `standalone.ts serve` (Fastify + Socket.IO)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NASTECH_MASTER_SECRET` | Yes | Master secret for auth/encryption |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | No | Redis for cross-process pub/sub (optional) |
| `ELEVENLABS_API_KEY` | No | Voice features via ElevenLabs |
| `VOICE_WEBHOOK_SECRET` | No | ElevenLabs webhook secret |

## Tech Stack

- **Runtime**: Bun
- **Backend**: Fastify v5, Socket.IO, Prisma ORM
- **Database**: PostgreSQL (Replit built-in)
- **Auth**: Custom JWT/token system with libsodium encryption
- **Mobile**: Expo / React Native
- **Desktop**: Electron (codium), Tauri (nastech-app)

## User Preferences

- Use bun as the runtime (not node/npm directly)
- Keep pnpm as the package manager for the monorepo
