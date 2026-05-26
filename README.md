<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/.github/logotype-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="/.github/logotype-light.png">
    <img src="/.github/logotype-dark.png" width="400" alt="NasTech">
  </picture>
</div>

<h1 align="center">
  Mobile and Web Client for Claude Code & Codex
</h1>

<h4 align="center">
Use Claude Code or Codex from anywhere with end-to-end encryption.
</h4>

<div align="center">
  
[🌐 **Web App**](https://ba.nastech.workers.dev) • [🎥 **See a Demo**](https://youtu.be/GCS0OG9QMSE) • [💬 **Discord**](https://discord.gg/fX9WBAhyfD)

</div>

<img width="5178" height="2364" alt="github" src="/.github/header.png" />


<h3 align="center">
Step 1: Download App
</h3>

<div align="center">
<a href="https://ba.nastech.workers.dev"><img width="135" height="39" alt="webapp" src="https://github.com/user-attachments/assets/45e31a11-cf6b-40a2-a083-6dc8d1f01291" /></a>
</div>

<h3 align="center">
Step 2: Install CLI on your computer
</h3>

```bash
npm install -g nastech
```

<h3 align="center">
Step 3: Start using `nastech` instead of `claude` or `codex`
</h3>

```bash
# Instead of claude, use:
nastech claude
# or
nastech codex
```

## How does it work?

On your computer, run `nastech` instead of `claude` or `nastech codex` instead of `codex` to start your AI through our wrapper. When you want to control your coding agent from your phone, it restarts the session in remote mode. To switch back to your computer, just press any key on your keyboard.

## 🔥 Why NasTech?

- 📱 **Mobile access to Claude Code and Codex** - Check what your AI is building while away from your desk
- 🔔 **Push notifications** - Get alerted when Claude Code and Codex needs permission or encounters errors  
- ⚡ **Switch devices instantly** - Take control from phone or desktop with one keypress
- 🔐 **End-to-end encrypted** - Your code never leaves your devices unencrypted
- 🛠️ **Open source** - Audit the code yourself. No telemetry, no tracking

## 📦 Project Components

- **[NasTech App](https://github.com/nastech-ai/nastech/tree/main/packages/nastech-app)** - Web UI + mobile client (Expo)
- **[NasTech CLI](https://github.com/nastech-ai/nastech/tree/main/packages/nastech-cli)** - Command-line interface for Claude Code and Codex
- **[NasTech Agent](https://github.com/nastech-ai/nastech/tree/main/packages/nastech-agent)** - Remote agent control CLI (create, send, monitor sessions)
- **[NasTech Server](https://github.com/nastech-ai/nastech/tree/main/packages/nastech-server)** - Backend server for encrypted sync

## 🏠 Who We Are

We're engineers scattered across Bay Area coffee shops and hacker houses, constantly checking how our AI coding agents are progressing on our pet projects during lunch breaks. NasTech was born from the frustration of not being able to peek at our AI coding tools building our side hustles while we're away from our keyboards. We believe the best tools come from scratching your own itch and sharing with the community.

## 📚 Documentation & Contributing

- **[Contributing Guide](docs/CONTRIBUTING.md)** - How to contribute, PR guidelines, and development setup

## License

MIT License - see [LICENSE](LICENSE) for details.
