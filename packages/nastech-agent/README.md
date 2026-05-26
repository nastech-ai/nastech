# NasTech Agent

CLI client for controlling NasTech agents remotely.

Unlike `nastech-cli` which both runs and controls agents, `nastech-agent` only controls them — listing machines, spawning sessions on a machine, creating sessions, sending messages, reading history, monitoring state, and stopping sessions.

## Installation

From the monorepo:

```bash
pnpm --filter nastech-agent build
```

Or link globally:

```bash
cd packages/nastech-agent && npm link
```

## Authentication

NasTech Agent uses account authentication via QR code, the same flow as linking a device in the NasTech mobile app.

```bash
# Authenticate by scanning QR code with the NasTech mobile app
nastech-agent auth login

# Check authentication status
nastech-agent auth status

# Clear stored credentials
nastech-agent auth logout
```

Credentials are stored at `~/.nastech/agent.key`.

## Commands

### List sessions

```bash
# List all sessions
nastech-agent list

# List only active sessions
nastech-agent list --active

# Output as JSON
nastech-agent list --json
```

### List machines

```bash
# List all machines
nastech-agent machines

# List only active machines
nastech-agent machines --active

# Output as JSON
nastech-agent machines --json
```

### Spawn on a machine

```bash
# Spawn a session on a specific machine
nastech-agent spawn --machine <machine-id> --path ~/project

# Let the daemon create the directory if needed
nastech-agent spawn --machine <machine-id> --path ~/new-project --create-dir

# Choose a specific agent
nastech-agent spawn --machine <machine-id> --path ~/project --agent codex

# Output as JSON
nastech-agent spawn --machine <machine-id> --path ~/project --json
```

### Session status

```bash
# Get live session state (supports ID prefix matching)
nastech-agent status <session-id>

# Output as JSON
nastech-agent status <session-id> --json
```

### Create a session

```bash
# Create a new session with a tag
nastech-agent create --tag my-project

# Specify a working directory
nastech-agent create --tag my-project --path /home/user/project

# Output as JSON
nastech-agent create --tag my-project --json
```

### Send a message

```bash
# Send a message to a session
nastech-agent send <session-id> "Fix the login bug"

# Send with yolo permissions
nastech-agent send <session-id> "Ship it" --yolo

# Send and wait for the agent to finish
nastech-agent send <session-id> "Run the tests" --wait

# Output as JSON
nastech-agent send <session-id> "Hello" --json
```

### Message history

```bash
# View message history
nastech-agent history <session-id>

# Limit to last N messages
nastech-agent history <session-id> --limit 10

# Output as JSON
nastech-agent history <session-id> --json
```

### Stop a session

```bash
nastech-agent stop <session-id>
```

### Wait for idle

```bash
# Wait for agent to become idle (default 300s timeout)
nastech-agent wait <session-id>

# Custom timeout
nastech-agent wait <session-id> --timeout 60
```

Exit code 0 when agent becomes idle, 1 on timeout.

## Environment Variables

- `NASTECH_SERVER_URL` - API server URL (default: `https://api.nastech.workers.dev`)
- `NASTECH_HOME_DIR` - Home directory for credential storage (default: `~/.nastech`)

## Session ID Matching

All commands that accept a `<session-id>` support prefix matching. You can provide the first few characters of a session ID and the CLI will resolve the full ID.

Machine-aware commands such as `spawn --machine <machine-id>` also support ID prefix matching.

## Encryption

All machine and session data is end-to-end encrypted. New records use AES-256-GCM with per-record keys. Existing records created by other clients are decrypted using the appropriate key scheme (AES-256-GCM or legacy NaCl secretbox).

## Requirements

- Node.js >= 20.0.0
- A NasTech account for authentication

## Publishing to npm

Maintainers can publish a new version:

```bash
pnpm release               # From repo root: choose library to release
# or directly:
pnpm --filter nastech-agent release
```

This flow:
- runs tests/build checks via `prepublishOnly`
- creates a release commit and `nastech-agent-vX.Y.Z` tag
- creates a GitHub release with generated notes
- publishes `nastech-agent` to npm

## License

MIT — NasTech Contributors
