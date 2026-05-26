# NasTech Cloudflare Workers

Four workers — paste each file into your Cloudflare dashboard, or deploy with Wrangler.

| Worker file | Domain | Purpose |
|---|---|---|
| `api-worker.js` | `api.nastech.workers.dev` | API proxy / backend gateway |
| `ai-worker.js` | `ai.nastech.workers.dev` | Multi-provider AI chat completions |
| `privacy-worker.js` | `privacy.nastech.workers.dev` | Privacy policy page |
| `ba-worker.js` | `ba.nastech.workers.dev` | Web app / landing page |

## Deploy via Cloudflare Dashboard (no CLI needed)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create** → **Create Worker**
3. Paste the worker file content, name it (e.g. `nastech-api`)
4. Click **Deploy**
5. Go to **Settings → Domains & Routes** and add your custom route (`api.nastech.workers.dev/*`)

Repeat for each of the 4 workers.

## Deploy via Wrangler CLI

```bash
cd worker
npx wrangler deploy api-worker.js --name nastech-api
npx wrangler deploy ai-worker.js --name nastech-ai
npx wrangler deploy privacy-worker.js --name nastech-privacy
npx wrangler deploy ba-worker.js --name nastech-ba
```

## AI Worker Providers

The `ai-worker.js` supports:

| Provider | Free? | Header |
|---|---|---|
| Cloudflare Workers AI | ✅ Free | (none, uses `AI` binding) |
| OpenAI | ❌ Paid | `X-NasTech-API-Key` + `X-NasTech-Provider: openai` |
| Anthropic | ❌ Paid | `X-NasTech-API-Key` + `X-NasTech-Provider: anthropic` |
| Groq | ✅ Free tier | `X-NasTech-API-Key` + `X-NasTech-Provider: groq` |
| Ollama | ✅ Local | `X-NasTech-Base-URL` + `X-NasTech-Provider: ollama` |
| Custom | varies | `X-NasTech-API-Key` + `X-NasTech-Base-URL` |

## Environment Variables

`api-worker.js`:
- `BACKEND_URL` — URL of your self-hosted NasTech server (optional)

`ba-worker.js`:
- `APP_URL` — URL of your self-hosted web app (optional)

## Server-Side AI (PC Off Mode)

When a user's PC is off, the NasTech mobile app can still send AI chat requests
to `api.nastech.workers.dev/v1/ai/chat` on the server using the user's configured
provider and API key. The key is stored locally on the device and sent with the request —
it never persists on the server.
