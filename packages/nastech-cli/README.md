# NasTech

Code on the go — control AI coding agents from your phone, browser, or terminal.

Free. Open source. Code anywhere.

## Installation

### From GitHub (recommended)

```bash
git clone https://github.com/nastech-ai/nastech
cd nastech
pnpm install
pnpm --filter nastech cli:install
```

This installs the `nastech` command globally on your system from the latest source.

### Requirements

- Node.js >= 20.0.0
- pnpm >= 9

## Usage

### Claude Code (default)

```bash
nastech
# or
nastech claude
```

This will:
1. Start a Claude Code session
2. Display a QR code to connect from your mobile device or browser
3. Allow real-time session control — all communication is end-to-end encrypted
4. Start new sessions directly from your phone or web while your computer is online

### More agents

```
nastech codex
nastech gemini
nastech openclaw

# or any ACP-compatible CLI
nastech acp opencode
nastech acp -- custom-agent --flag
```

## Daemon

The daemon is a background service that stays running on your machine. It lets you spawn and manage coding sessions remotely — from your phone or the web app — without needing an open terminal.

```bash
nastech daemon start
nastech daemon stop
nastech daemon status
nastech daemon list
```

The daemon starts automatically when you run `nastech`, so you usually don't need to manage it manually.

### Keeping the daemon running across reboots

If you want the daemon to come back automatically after a reboot — without opening a `nastech` session first — start it from your shell profile so it inherits your normal user session context (PATH, keychain access, OAuth credentials):

```bash
# ~/.zshrc or ~/.bashrc
if [[ -o interactive ]] && [[ -z "$NASTECH_DAEMON_CHECKED" ]]; then
    export NASTECH_DAEMON_CHECKED=1
    () {
        local state=$HOME/.nastech/daemon.state.json
        local pid=$(grep -oE '"pid"[[:space:]]*:[[:space:]]*[0-9]+' "$state" 2>/dev/null | grep -oE '[0-9]+')
        if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
            nastech daemon start >/dev/null 2>&1
        fi
    } &!
fi
```

The first interactive shell after a reboot triggers the start; subsequent shells short-circuit because the daemon is already running.

> **macOS users:** prefer this shell-init approach over a `launchd` LaunchAgent. A LaunchAgent runs in an agent domain that is **detached from your GUI/Aqua login session**, which means the bundled `claude-agent-sdk` cannot reach the macOS keychain and silently fails authentication ("Failed to authenticate. API Error: 401 terminated", `duration_api_ms: 0`). If you must use launchd, your wrapper has to read the OAuth access token from `~/.claude/.credentials.json` and export it as `CLAUDE_CODE_OAUTH_TOKEN` before exec'ing the daemon — and you'll need to handle token rotation yourself.

## Authentication

```bash
nastech auth login
nastech auth logout
```

NasTech uses cryptographic key pairs for authentication — your private key stays on your machine. All session data is end-to-end encrypted before leaving your device.

To connect third-party agent APIs:

```bash
nastech connect gemini
nastech connect claude
nastech connect codex
nastech connect status
```

## Commands

| Command | Description |
|---------|-------------|
| `nastech` | Start Claude Code session (default) |
| `nastech codex` | Start Codex mode |
| `nastech gemini` | Start Gemini CLI session |
| `nastech openclaw` | Start OpenClaw session |
| `nastech acp` | Start any ACP-compatible agent |
| `nastech resume <id>` | Resume a previous session |
| `nastech notify` | Send push notification to your devices |
| `nastech doctor` | Diagnostics & troubleshooting |

---

## Advanced

### Environment Variables

| Variable | Description |
|----------|-------------|
| `NASTECH_SERVER_URL` | Custom server URL (default: `https://api.nastech.workers.dev`) |
| `NASTECH_WEBAPP_URL` | Custom web app URL (default: `https://ba.nastech.workers.dev`) |
| `NASTECH_HOME_DIR` | Custom home directory for NasTech data (default: `~/.nastech`) |
| `NASTECH_DISABLE_CAFFEINATE` | Disable macOS sleep prevention |
| `NASTECH_EXPERIMENTAL` | Enable experimental features |

### Sandbox (experimental)

NasTech can run agents inside an OS-level sandbox to restrict file system and network access.

```bash
nastech sandbox configure
nastech sandbox status
nastech sandbox disable
```

### Building from source

```bash
git clone https://github.com/nastech-ai/nastech
cd nastech
pnpm install
pnpm --filter nastech build
```

## Requirements

- Node.js >= 20.0.0
- pnpm >= 9
- For Claude: `claude` CLI installed & logged in
- For Codex: `codex` CLI installed & logged in
- For Gemini: `npm install -g @google/gemini-cli` + `nastech connect gemini`

## License

MIT
