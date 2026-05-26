/**
 * NasTech Web App Worker
 * Cloudflare Worker for ba.nastech.workers.dev
 *
 * Serves the NasTech web app. In production this proxies to
 * the built static files or to a self-hosted server.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Redirect root to app
    if (url.pathname === '/') {
      return Response.redirect('https://ba.nastech.workers.dev/app', 302);
    }

    // Proxy to app backend if configured
    const appUrl = env.APP_URL;
    if (appUrl) {
      const targetUrl = new URL(url.pathname + url.search, appUrl);
      try {
        const resp = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
        });
        const headers = new Headers(resp.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        return new Response(resp.body, { status: resp.status, headers });
      } catch (err) {
        return appUnavailableResponse();
      }
    }

    return appUnavailableResponse();
  },
};

function appUnavailableResponse() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NasTech</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f2f2f7; }
  .card { background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 420px; }
  h1 { color: #007AFF; margin: 0 0 12px; } p { color: #666; margin: 0 0 24px; }
  a { display: inline-block; background: #007AFF; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; }
  @media (prefers-color-scheme: dark) { body { background: #1c1c1e; } .card { background: #2c2c2e; } p { color: #8e8e93; } }
</style>
</head>
<body>
<div class="card">
  <h1>NasTech</h1>
  <p>The mobile app is the best way to use NasTech. Download it for iOS or Android.</p>
  <a href="https://github.com/nastech-ai/nastech">View on GitHub</a>
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
