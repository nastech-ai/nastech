/**
 * NasTech Web App Worker
 * Cloudflare Worker for ba.nastech.workers.dev
 *
 * Serves the NasTech web app. In production this proxies to
 * the built static files or to a self-hosted server.
 * Falls back to a branded landing page when backend is unavailable.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Proxy to app backend if configured
    const appUrl = env.APP_URL;
    if (appUrl && url.pathname !== '/') {
      const targetUrl = new URL(url.pathname + url.search, appUrl);
      try {
        const resp = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        });
        // Only proxy successful responses — fall back on 4xx/5xx
        if (resp.ok) {
          const headers = new Headers(resp.headers);
          headers.set('Access-Control-Allow-Origin', '*');
          return new Response(resp.body, { status: resp.status, headers });
        }
        // Backend returned an error — show landing page
      } catch {
        // Backend unreachable — show landing page
      }
    }

    // Serve branded landing page for root and any unresolved paths
    return landingPageResponse();
  },
};

function landingPageResponse() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NasTech — AI Agent Platform</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; background: #f2f2f7; padding: 24px;
  }
  .card {
    background: white; border-radius: 20px; padding: 48px 40px;
    text-align: center; box-shadow: 0 8px 32px rgba(0,0,0,0.1);
    max-width: 460px; width: 100%;
  }
  .logo {
    width: 72px; height: 72px; background: #007AFF; border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 24px; font-size: 36px;
  }
  h1 { color: #1c1c1e; font-size: 28px; font-weight: 700; margin-bottom: 12px; }
  .tagline { color: #636366; font-size: 16px; line-height: 1.5; margin-bottom: 32px; }
  .buttons { display: flex; flex-direction: column; gap: 12px; }
  .btn {
    display: block; padding: 14px 28px; border-radius: 12px;
    text-decoration: none; font-weight: 600; font-size: 16px;
    transition: opacity 0.15s;
  }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: #007AFF; color: white; }
  .btn-secondary { background: #f2f2f7; color: #007AFF; }
  .links { margin-top: 28px; display: flex; justify-content: center; gap: 24px; }
  .links a { color: #8e8e93; font-size: 14px; text-decoration: none; }
  .links a:hover { color: #007AFF; }
  @media (prefers-color-scheme: dark) {
    body { background: #000; }
    .card { background: #1c1c1e; }
    h1 { color: white; }
    .tagline { color: #8e8e93; }
    .btn-secondary { background: #2c2c2e; }
    .links a { color: #636366; }
  }
</style>
</head>
<body>
<div class="card">
  <div class="logo">⚡</div>
  <h1>NasTech</h1>
  <p class="tagline">AI agent coordination platform. Connect your mobile or CLI client with remote AI agents over secure, encrypted real-time connections.</p>
  <div class="buttons">
    <a class="btn btn-primary" href="https://github.com/nastech-ai/nastech">View on GitHub</a>
    <a class="btn btn-secondary" href="https://privacy.nastech.workers.dev/">Privacy Policy</a>
  </div>
  <div class="links">
    <a href="https://api.nastech.workers.dev/v1/health">API Status</a>
    <a href="https://ai.nastech.workers.dev/">AI Service</a>
  </div>
</div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-NasTech-Client',
  };
}
