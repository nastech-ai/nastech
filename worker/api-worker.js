/**
 * NasTech API Worker — Self-Contained
 * Cloudflare Worker for api.nastech.workers.dev
 *
 * Fully self-contained: no external backend needed.
 * Stores all data in Cloudflare KV.
 *
 * Required env bindings (set in Cloudflare dashboard):
 *   NASTECH_KV            — KV namespace binding
 *   NASTECH_MASTER_SECRET — Secret for signing JWT tokens
 *
 * Endpoints:
 *   POST /v1/auth                    → Ed25519 verify, create/find account, return JWT
 *   POST /v1/auth/request            → Terminal QR auth
 *   GET  /v1/auth/request/status     → Poll QR auth status
 *   POST /v1/auth/response           → Approve QR auth (requires JWT)
 *   POST /v1/auth/account/request    → Device linking
 *   POST /v1/auth/account/response   → Approve device link (requires JWT)
 *   GET  /v1/account/profile         → Get profile (requires JWT)
 *   POST /v1/account/profile         → Update profile (requires JWT)
 *   GET  /v1/account/settings        → Get settings (requires JWT)
 *   POST /v1/account/settings        → Update settings (requires JWT)
 *   GET  /v1/kv                      → KV sync get (requires JWT)
 *   POST /v1/kv                      → KV sync set (requires JWT)
 *   GET  /v1/ws                      → WebSocket (token in ?token=...)
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

const enc = (s) => new TextEncoder().encode(s);

function b64ToBytes(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - std.length % 4) % 4);
  const bin = atob(padded);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(obj) {
  return btoa(JSON.stringify(obj))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s) {
  return JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
}

// ─── JWT (HS256) ──────────────────────────────────────────────────────────────

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', enc(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function makeToken(userId, secret, extras = {}) {
  const header = b64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlEncode({ sub: userId, iat: Math.floor(Date.now() / 1000), ...extras });
  const sig = await hmacSign(secret, `${header}.${payload}`);
  return `${header}.${payload}.${sig}`;
}

async function verifyToken(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expectedSig = await hmacSign(secret, `${header}.${payload}`);
  if (sig !== expectedSig) return null;
  try { return b64urlDecode(payload).sub; } catch { return null; }
}

// ─── Ed25519 ──────────────────────────────────────────────────────────────────

async function verifyEd25519(challenge, signature, publicKey) {
  try {
    const key = await crypto.subtle.importKey(
      'raw', publicKey, { name: 'Ed25519' }, false, ['verify']
    );
    return await crypto.subtle.verify('Ed25519', key, signature, challenge);
  } catch {
    return false;
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getSecret(env) {
  return env.NASTECH_MASTER_SECRET || 'nastech-insecure-default-CHANGE-ME';
}

function getBearerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const url = new URL(request.url);
  return url.searchParams.get('token') || null;
}

async function requireAuth(request, env) {
  const tok = getBearerToken(request);
  return verifyToken(tok, getSecret(env));
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-NasTech-Client, Upgrade, Connection',
    'Access-Control-Expose-Headers': 'Content-Length',
  };
}

function jsonR(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function cors204() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ─── Auth handlers ────────────────────────────────────────────────────────────

async function handleAuth(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { publicKey, challenge, signature } = body;
  if (!publicKey || !challenge || !signature) {
    return jsonR({ error: 'Missing fields: publicKey, challenge, signature' }, 400);
  }

  const pubKeyBytes = b64ToBytes(publicKey);
  const challengeBytes = b64ToBytes(challenge);
  const sigBytes = b64ToBytes(signature);

  const isValid = await verifyEd25519(challengeBytes, sigBytes, pubKeyBytes);
  if (!isValid) return jsonR({ error: 'Invalid signature' }, 401);

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;

  let account = null;
  try { account = JSON.parse(await kv.get(`account:${publicKeyHex}`) || 'null'); } catch {}

  if (!account) {
    account = {
      id: crypto.randomUUID(),
      publicKey: publicKeyHex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: null,
      settingsVersion: 0,
      firstName: null,
      lastName: null,
      username: null,
    };
    await kv.put(`account:${publicKeyHex}`, JSON.stringify(account));
    await kv.put(`account_id:${account.id}`, publicKeyHex);
  } else {
    account.updatedAt = new Date().toISOString();
    await kv.put(`account:${publicKeyHex}`, JSON.stringify(account));
  }

  const token = await makeToken(account.id, getSecret(env));
  return jsonR({ success: true, token });
}

// Terminal QR auth ─────────────────────────────────────────────────────────────

async function handleAuthRequest(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { publicKey, supportsV2 } = body;
  if (!publicKey) return jsonR({ error: 'Missing publicKey' }, 400);

  const pubKeyBytes = b64ToBytes(publicKey);
  if (pubKeyBytes.length !== 32) return jsonR({ error: 'Invalid public key' }, 401);

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;
  const key = `terminal_auth:${publicKeyHex}`;

  let req = null;
  try { req = JSON.parse(await kv.get(key) || 'null'); } catch {}

  if (!req) {
    req = { id: crypto.randomUUID(), publicKey: publicKeyHex, supportsV2: !!supportsV2, createdAt: new Date().toISOString() };
    await kv.put(key, JSON.stringify(req), { expirationTtl: 600 });
  }

  if (req.response && req.responseAccountId) {
    const token = await makeToken(req.responseAccountId, getSecret(env), { session: req.id });
    return jsonR({ state: 'authorized', token, response: req.response });
  }

  return jsonR({ state: 'requested' });
}

async function handleAuthRequestStatus(request, env) {
  const url = new URL(request.url);
  const publicKey = url.searchParams.get('publicKey');
  if (!publicKey) return jsonR({ status: 'not_found', supportsV2: false });

  let pubKeyBytes;
  try { pubKeyBytes = b64ToBytes(publicKey); } catch { return jsonR({ status: 'not_found', supportsV2: false }); }
  if (pubKeyBytes.length !== 32) return jsonR({ status: 'not_found', supportsV2: false });

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;
  let req = null;
  try { req = JSON.parse(await kv.get(`terminal_auth:${publicKeyHex}`) || 'null'); } catch {}

  if (!req) return jsonR({ status: 'not_found', supportsV2: false });
  if (req.response && req.responseAccountId) return jsonR({ status: 'authorized', supportsV2: req.supportsV2 || false });
  return jsonR({ status: 'pending', supportsV2: req.supportsV2 || false });
}

async function handleAuthResponse(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { response, publicKey } = body;
  if (!response || !publicKey) return jsonR({ error: 'Missing fields' }, 400);

  const pubKeyBytes = b64ToBytes(publicKey);
  if (pubKeyBytes.length !== 32) return jsonR({ error: 'Invalid public key' }, 401);

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;
  const key = `terminal_auth:${publicKeyHex}`;
  let req = null;
  try { req = JSON.parse(await kv.get(key) || 'null'); } catch {}

  if (!req) return jsonR({ error: 'Request not found' }, 404);
  if (!req.response) {
    req.response = response;
    req.responseAccountId = userId;
    await kv.put(key, JSON.stringify(req), { expirationTtl: 600 });
  }
  return jsonR({ success: true });
}

// Account device linking ───────────────────────────────────────────────────────

async function handleAccountAuthRequest(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { publicKey } = body;
  if (!publicKey) return jsonR({ error: 'Missing publicKey' }, 400);

  const pubKeyBytes = b64ToBytes(publicKey);
  if (pubKeyBytes.length !== 32) return jsonR({ error: 'Invalid public key' }, 401);

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;
  const key = `account_auth:${publicKeyHex}`;

  let req = null;
  try { req = JSON.parse(await kv.get(key) || 'null'); } catch {}

  if (!req) {
    req = { id: crypto.randomUUID(), publicKey: publicKeyHex, createdAt: new Date().toISOString() };
    await kv.put(key, JSON.stringify(req), { expirationTtl: 600 });
  }

  if (req.response && req.responseAccountId) {
    const token = await makeToken(req.responseAccountId, getSecret(env));
    return jsonR({ state: 'authorized', token, response: req.response });
  }

  return jsonR({ state: 'requested' });
}

async function handleAccountAuthResponse(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { response, publicKey } = body;
  if (!response || !publicKey) return jsonR({ error: 'Missing fields' }, 400);

  const pubKeyBytes = b64ToBytes(publicKey);
  if (pubKeyBytes.length !== 32) return jsonR({ error: 'Invalid public key' }, 401);

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;
  const key = `account_auth:${publicKeyHex}`;
  let req = null;
  try { req = JSON.parse(await kv.get(key) || 'null'); } catch {}

  if (!req) return jsonR({ error: 'Request not found' }, 404);
  if (!req.response) {
    req.response = response;
    req.responseAccountId = userId;
    await kv.put(key, JSON.stringify(req), { expirationTtl: 600 });
  }
  return jsonR({ success: true });
}

// Account profile & settings ──────────────────────────────────────────────────

async function handleGetProfile(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  const kv = env.NASTECH_KV;
  const publicKeyHex = await kv.get(`account_id:${userId}`);
  if (!publicKeyHex) return jsonR({ error: 'Account not found' }, 404);

  const account = JSON.parse(await kv.get(`account:${publicKeyHex}`) || 'null');
  if (!account) return jsonR({ error: 'Account not found' }, 404);

  return jsonR({
    id: userId,
    timestamp: Date.now(),
    firstName: account.firstName || null,
    lastName: account.lastName || null,
    username: account.username || null,
    avatar: null,
    github: null,
    connectedServices: [],
  });
}

async function handleUpdateProfile(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  const kv = env.NASTECH_KV;
  const publicKeyHex = await kv.get(`account_id:${userId}`);
  if (!publicKeyHex) return jsonR({ error: 'Account not found' }, 404);

  const account = JSON.parse(await kv.get(`account:${publicKeyHex}`) || 'null');
  if (!account) return jsonR({ error: 'Account not found' }, 404);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  if (body.firstName !== undefined) account.firstName = body.firstName;
  if (body.lastName !== undefined) account.lastName = body.lastName;
  if (body.username !== undefined) account.username = body.username;
  account.updatedAt = new Date().toISOString();

  await kv.put(`account:${publicKeyHex}`, JSON.stringify(account));
  return jsonR({ success: true });
}

async function handleGetSettings(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  const kv = env.NASTECH_KV;
  const publicKeyHex = await kv.get(`account_id:${userId}`);
  if (!publicKeyHex) return jsonR({ settings: null, settingsVersion: 0 });

  const account = JSON.parse(await kv.get(`account:${publicKeyHex}`) || 'null');
  return jsonR({ settings: account?.settings || null, settingsVersion: account?.settingsVersion || 0 });
}

async function handleUpdateSettings(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { settings, expectedVersion } = body;
  const kv = env.NASTECH_KV;
  const publicKeyHex = await kv.get(`account_id:${userId}`);
  if (!publicKeyHex) return jsonR({ success: false, error: 'Failed to update account settings' }, 500);

  const account = JSON.parse(await kv.get(`account:${publicKeyHex}`) || 'null');
  if (!account) return jsonR({ success: false, error: 'Failed to update account settings' }, 500);

  if (typeof expectedVersion === 'number' && account.settingsVersion !== expectedVersion) {
    return jsonR({ success: false, error: 'version-mismatch', currentVersion: account.settingsVersion, currentSettings: account.settings });
  }

  account.settings = settings;
  account.settingsVersion = (account.settingsVersion || 0) + 1;
  account.updatedAt = new Date().toISOString();
  await kv.put(`account:${publicKeyHex}`, JSON.stringify(account));

  return jsonR({ success: true, version: account.settingsVersion });
}

// KV sync ─────────────────────────────────────────────────────────────────────

async function handleKvGet(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  const url = new URL(request.url);
  const kvKey = url.searchParams.get('key');
  if (!kvKey) return jsonR({ error: 'Missing key' }, 400);

  const val = await env.NASTECH_KV.get(`user_kv:${userId}:${kvKey}`);
  return jsonR({ key: kvKey, value: val });
}

async function handleKvSet(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const { key, value } = body;
  if (!key) return jsonR({ error: 'Missing key' }, 400);

  if (value === null || value === undefined) {
    await env.NASTECH_KV.delete(`user_kv:${userId}:${key}`);
  } else {
    await env.NASTECH_KV.put(`user_kv:${userId}:${key}`, String(value));
  }
  return jsonR({ success: true });
}

// WebSocket ───────────────────────────────────────────────────────────────────

async function handleWebSocket(request, env) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426, headers: corsHeaders() });
  }

  const userId = await requireAuth(request, env);

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);

  server.accept();

  server.addEventListener('message', (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'ping') {
        server.send(JSON.stringify({ type: 'pong', id: msg.id }));
      } else {
        server.send(JSON.stringify({ type: 'ack', id: msg.id }));
      }
    } catch {}
  });

  server.addEventListener('close', () => {});
  server.addEventListener('error', () => {});

  const welcome = userId
    ? { type: 'connected', userId, timestamp: Date.now() }
    : { type: 'connected', auth: 'anonymous', timestamp: Date.now() };

  setTimeout(() => { try { server.send(JSON.stringify(welcome)); } catch {} }, 0);

  return new Response(null, { status: 101, webSocket: client });
}

// ─── Main Router ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    if (method === 'OPTIONS') return cors204();

    if (path === '/' || path === '/health') {
      return jsonR({ status: 'ok', service: 'NasTech API', version: '1.1.0', kv: env.NASTECH_KV ? 'connected' : 'not configured' });
    }

    if (method === 'POST' && path === '/v1/auth') return handleAuth(request, env);
    if (method === 'POST' && path === '/v1/auth/request') return handleAuthRequest(request, env);
    if (method === 'GET'  && path === '/v1/auth/request/status') return handleAuthRequestStatus(request, env);
    if (method === 'POST' && path === '/v1/auth/response') return handleAuthResponse(request, env);
    if (method === 'POST' && path === '/v1/auth/account/request') return handleAccountAuthRequest(request, env);
    if (method === 'POST' && path === '/v1/auth/account/response') return handleAccountAuthResponse(request, env);

    if (method === 'GET'  && path === '/v1/account/profile') return handleGetProfile(request, env);
    if (method === 'POST' && path === '/v1/account/profile') return handleUpdateProfile(request, env);
    if (method === 'GET'  && path === '/v1/account/settings') return handleGetSettings(request, env);
    if (method === 'POST' && path === '/v1/account/settings') return handleUpdateSettings(request, env);

    if (method === 'GET'  && path === '/v1/kv') return handleKvGet(request, env);
    if (method === 'POST' && path === '/v1/kv') return handleKvSet(request, env);

    if (path === '/v1/ws') return handleWebSocket(request, env);

    return jsonR({ error: 'Not found', path }, 404);
  },
};
