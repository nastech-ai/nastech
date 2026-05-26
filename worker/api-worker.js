/**
 * NasTech API Worker
 * Cloudflare Worker for api.nastech.workers.dev
 * 
 * Routes API requests to the NasTech server.
 * Supports CORS, health checks, and proxying to self-hosted instances.
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

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({ status: 'ok', service: 'NasTech API', version: '1.0.0' });
    }

    // Proxy to backend if configured
    const backendUrl = env.BACKEND_URL;
    if (backendUrl) {
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
    }

    return jsonResponse({ error: 'No backend configured' }, 503);
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-NasTech-Client',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
