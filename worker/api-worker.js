/**
 * NasTech API Worker
 * Cloudflare Worker for api.nastech.workers.dev
 *
 * Routes API requests to the self-hosted NasTech server.
 * Supports CORS, health checks, WebSocket proxying, and HTTP proxying.
 *
 * Required env var:
 *   BACKEND_URL  — URL of your running nastech-server (e.g. https://yourserver.com)
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // Health check (no backend needed)
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'NasTech API',
        version: '1.0.0',
        backend: env.BACKEND_URL ? 'configured' : 'not configured',
      });
    }

    const backendUrl = env.BACKEND_URL;
    if (!backendUrl) {
      return jsonResponse({ error: 'No backend configured. Set the BACKEND_URL environment variable in your Cloudflare Worker settings.' }, 503);
    }

    // WebSocket upgrade — proxy transparently to backend
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader && upgradeHeader.toLowerCase() === 'websocket') {
      const wsUrl = new URL(url.pathname + url.search, backendUrl);
      wsUrl.protocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
      try {
        const resp = await fetch(wsUrl.toString(), {
          headers: request.headers,
        });
        return resp;
      } catch (err) {
        return new Response('WebSocket backend unavailable: ' + String(err), { status: 502 });
      }
    }

    // HTTP proxy to backend
    const targetUrl = new URL(url.pathname + url.search, backendUrl);
    const proxyReq = new Request(targetUrl.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    });

    try {
      const resp = await fetch(proxyReq);
      const headers = new Headers(resp.headers);
      Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
      return new Response(resp.body, { status: resp.status, headers });
    } catch (err) {
      return jsonResponse({ error: 'Backend unavailable', detail: String(err) }, 502);
    }
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-NasTech-Client, Upgrade, Connection',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
