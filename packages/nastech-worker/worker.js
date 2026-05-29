/**
 * NasTech API Worker — Complete Self-Contained v2.0
 * Cloudflare Worker for api.nastech.workers.dev
 *
 * Bindings (set in Cloudflare dashboard):
 *   NASTECH_KV            — KV namespace
 *   NASTECH_MASTER_SECRET — JWT signing secret
 *
 * All data stored in KV. No external backend required.
 */

// ─── Utilities ────────────────────────────────────────────────────────────────

const enc = (s) => new TextEncoder().encode(s);

function b64ToBytes(s) {
  const std = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4);
  const bin = atob(padded);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64urlEncode(obj) {
  return btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(s) {
  return JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
}

function randomId(len = 16) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

// ─── JWT (HS256) ──────────────────────────────────────────────────────────────

async function hmacSign(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
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
    const key = await crypto.subtle.importKey('raw', publicKey, { name: 'Ed25519' }, false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, signature, challenge);
  } catch { return false; }
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
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

// ─── KV helpers ───────────────────────────────────────────────────────────────

async function kvGet(kv, key) {
  try { const v = await kv.get(key); return v ? JSON.parse(v) : null; } catch { return null; }
}

async function kvSet(kv, key, value, opts) {
  await kv.put(key, JSON.stringify(value), opts);
}

// ─── Auth handlers ────────────────────────────────────────────────────────────

async function handleAuth(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { publicKey, challenge, signature } = body;
  if (!publicKey || !challenge || !signature) return jsonR({ error: 'Missing fields' }, 400);

  const pubKeyBytes = b64ToBytes(publicKey);
  const challengeBytes = b64ToBytes(challenge);
  const sigBytes = b64ToBytes(signature);

  const isValid = await verifyEd25519(challengeBytes, sigBytes, pubKeyBytes);
  if (!isValid) return jsonR({ error: 'Invalid signature' }, 401);

  const publicKeyHex = bytesToHex(pubKeyBytes);
  const kv = env.NASTECH_KV;
  let account = await kvGet(kv, `account:${publicKeyHex}`);

  if (!account) {
    account = {
      id: crypto.randomUUID(),
      publicKey: publicKeyHex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      settings: null,
      settingsVersion: 0,
      firstName: null, lastName: null, username: null,
    };
    await kvSet(kv, `account:${publicKeyHex}`, account);
    await kv.put(`account_id:${account.id}`, publicKeyHex);
  } else {
    account.updatedAt = new Date().toISOString();
    await kvSet(kv, `account:${publicKeyHex}`, account);
  }

  const token = await makeToken(account.id, getSecret(env));
  return jsonR({ success: true, token });
}

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
  let req = await kvGet(kv, key);

  if (!req) {
    req = { id: crypto.randomUUID(), publicKey: publicKeyHex, supportsV2: !!supportsV2, createdAt: new Date().toISOString() };
    await kvSet(kv, key, req, { expirationTtl: 600 });
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
  const req = await kvGet(env.NASTECH_KV, `terminal_auth:${publicKeyHex}`);
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
  const key = `terminal_auth:${publicKeyHex}`;
  let req = await kvGet(env.NASTECH_KV, key);
  if (!req) return jsonR({ error: 'Request not found' }, 404);
  if (!req.response) {
    req.response = response;
    req.responseAccountId = userId;
    await kvSet(env.NASTECH_KV, key, req, { expirationTtl: 600 });
  }
  return jsonR({ success: true });
}

async function handleAccountAuthRequest(request, env) {
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { publicKey } = body;
  if (!publicKey) return jsonR({ error: 'Missing publicKey' }, 400);
  const pubKeyBytes = b64ToBytes(publicKey);
  if (pubKeyBytes.length !== 32) return jsonR({ error: 'Invalid public key' }, 401);
  const publicKeyHex = bytesToHex(pubKeyBytes);
  const key = `account_auth:${publicKeyHex}`;
  let req = await kvGet(env.NASTECH_KV, key);
  if (!req) {
    req = { id: crypto.randomUUID(), publicKey: publicKeyHex, createdAt: new Date().toISOString() };
    await kvSet(env.NASTECH_KV, key, req, { expirationTtl: 600 });
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
  const key = `account_auth:${publicKeyHex}`;
  let req = await kvGet(env.NASTECH_KV, key);
  if (!req) return jsonR({ error: 'Request not found' }, 404);
  if (!req.response) {
    req.response = response;
    req.responseAccountId = userId;
    await kvSet(env.NASTECH_KV, key, req, { expirationTtl: 600 });
  }
  return jsonR({ success: true });
}

// ─── Account handlers ─────────────────────────────────────────────────────────

async function handleGetProfile(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  const publicKeyHex = await kv.get(`account_id:${userId}`);
  if (!publicKeyHex) return jsonR({ error: 'Account not found' }, 404);
  const account = await kvGet(kv, `account:${publicKeyHex}`);
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
  const account = await kvGet(kv, `account:${publicKeyHex}`);
  if (!account) return jsonR({ error: 'Account not found' }, 404);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  if (body.firstName !== undefined) account.firstName = body.firstName;
  if (body.lastName !== undefined) account.lastName = body.lastName;
  if (body.username !== undefined) account.username = body.username;
  account.updatedAt = new Date().toISOString();
  await kvSet(kv, `account:${publicKeyHex}`, account);
  return jsonR({ success: true });
}

async function handleGetSettings(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const publicKeyHex = await env.NASTECH_KV.get(`account_id:${userId}`);
  if (!publicKeyHex) return jsonR({ settings: null, settingsVersion: 0 });
  const account = await kvGet(env.NASTECH_KV, `account:${publicKeyHex}`);
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
  if (!publicKeyHex) return jsonR({ success: false, error: 'Account not found' }, 500);
  const account = await kvGet(kv, `account:${publicKeyHex}`);
  if (!account) return jsonR({ success: false, error: 'Account not found' }, 500);
  if (typeof expectedVersion === 'number' && account.settingsVersion !== expectedVersion) {
    return jsonR({ success: false, error: 'version-mismatch', currentVersion: account.settingsVersion, currentSettings: account.settings });
  }
  account.settings = settings;
  account.settingsVersion = (account.settingsVersion || 0) + 1;
  account.updatedAt = new Date().toISOString();
  await kvSet(kv, `account:${publicKeyHex}`, account);
  return jsonR({ success: true, version: account.settingsVersion });
}

// ─── KV sync ─────────────────────────────────────────────────────────────────

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

async function handleKvBulkGet(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const url = new URL(request.url);
  const keysParam = url.searchParams.get('keys');
  if (!keysParam) return jsonR({ entries: [] });
  const keys = keysParam.split(',').filter(Boolean).slice(0, 100);
  const entries = await Promise.all(keys.map(async k => {
    const val = await env.NASTECH_KV.get(`user_kv:${userId}:${k}`);
    return { key: k, value: val };
  }));
  return jsonR({ entries });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

async function getSessionsList(kv, userId) {
  return (await kvGet(kv, `sessions_list:${userId}`)) || [];
}

async function saveSessionsList(kv, userId, sessions) {
  await kvSet(kv, `sessions_list:${userId}`, sessions.slice(0, 150));
}

async function handleGetSessions(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const sessions = await getSessionsList(env.NASTECH_KV, userId);
  return jsonR({ sessions });
}

async function handleCreateSession(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { id, metadata, dataEncryptionKey } = body;
  if (!id || !metadata) return jsonR({ error: 'Missing required fields: id, metadata' }, 400);

  const kv = env.NASTECH_KV;
  const now = Date.now();

  // Check if exists
  let existing = await kvGet(kv, `session:${id}`);
  if (existing) {
    return jsonR({ session: existing });
  }

  const session = {
    id,
    seq: now,
    accountId: userId,
    createdAt: now,
    updatedAt: now,
    active: true,
    lastActiveAt: now,
    metadata,
    metadataVersion: 1,
    agentState: null,
    agentStateVersion: 0,
    dataEncryptionKey: dataEncryptionKey || null,
  };

  await kvSet(kv, `session:${id}`, session);

  const sessions = await getSessionsList(kv, userId);
  const filtered = sessions.filter(s => s.id !== id);
  filtered.unshift(session);
  await saveSessionsList(kv, userId, filtered);

  return jsonR({ session });
}

async function handleGetSession(request, env, sessionId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const session = await kvGet(env.NASTECH_KV, `session:${sessionId}`);
  if (!session || session.accountId !== userId) return jsonR({ error: 'Not found' }, 404);
  return jsonR({ session });
}

async function handleUpdateSession(request, env, sessionId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  const session = await kvGet(kv, `session:${sessionId}`);
  if (!session || session.accountId !== userId) return jsonR({ error: 'Not found' }, 404);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const now = Date.now();
  if (body.metadata !== undefined) {
    session.metadata = body.metadata;
    session.metadataVersion = (session.metadataVersion || 0) + 1;
  }
  if (body.agentState !== undefined) {
    session.agentState = body.agentState;
    session.agentStateVersion = (session.agentStateVersion || 0) + 1;
  }
  if (body.active !== undefined) session.active = body.active;
  session.updatedAt = now;
  session.seq = now;

  await kvSet(kv, `session:${sessionId}`, session);

  const sessions = await getSessionsList(kv, userId);
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    sessions[idx] = session;
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    await saveSessionsList(kv, userId, sessions);
  }

  return jsonR({ success: true, session });
}

async function handleDeleteSession(request, env, sessionId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  const session = await kvGet(kv, `session:${sessionId}`);
  if (!session || session.accountId !== userId) return jsonR({ error: 'Not found' }, 404);
  await kv.delete(`session:${sessionId}`);
  await kv.delete(`session_messages:${sessionId}`);
  const sessions = await getSessionsList(kv, userId);
  await saveSessionsList(kv, userId, sessions.filter(s => s.id !== sessionId));
  return jsonR({ success: true });
}

// ─── Machines ─────────────────────────────────────────────────────────────────

async function getMachinesList(kv, userId) {
  return (await kvGet(kv, `machines_list:${userId}`)) || [];
}

async function saveMachinesList(kv, userId, machines) {
  await kvSet(kv, `machines_list:${userId}`, machines.slice(0, 100));
}

async function handleGetMachines(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const machines = await getMachinesList(env.NASTECH_KV, userId);
  return jsonR({ machines });
}

async function handleCreateMachine(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { id, metadata, daemonState, dataEncryptionKey } = body;
  if (!id || !metadata) return jsonR({ error: 'Missing required fields: id, metadata' }, 400);

  const kv = env.NASTECH_KV;
  const now = Date.now();

  let machine = await kvGet(kv, `machine:${id}`);
  if (machine) {
    return jsonR({ machine });
  }

  machine = {
    id,
    accountId: userId,
    metadata,
    metadataVersion: 1,
    daemonState: daemonState || null,
    daemonStateVersion: daemonState ? 1 : 0,
    dataEncryptionKey: dataEncryptionKey || null,
    active: false,
    activeAt: now,
    lastActiveAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await kvSet(kv, `machine:${id}`, machine);

  const machines = await getMachinesList(kv, userId);
  machines.unshift(machine);
  await saveMachinesList(kv, userId, machines);

  return jsonR({ machine });
}

async function handleGetMachine(request, env, machineId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const machine = await kvGet(env.NASTECH_KV, `machine:${machineId}`);
  if (!machine || machine.accountId !== userId) return jsonR({ error: 'Not found' }, 404);
  return jsonR({ machine });
}

async function handleUpdateMachine(request, env, machineId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  let machine = await kvGet(kv, `machine:${machineId}`);
  if (!machine || machine.accountId !== userId) return jsonR({ error: 'Not found' }, 404);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }

  const now = Date.now();
  if (body.metadata !== undefined) { machine.metadata = body.metadata; machine.metadataVersion = (machine.metadataVersion || 0) + 1; }
  if (body.daemonState !== undefined) { machine.daemonState = body.daemonState; machine.daemonStateVersion = (machine.daemonStateVersion || 0) + 1; }
  if (body.active !== undefined) { machine.active = body.active; machine.activeAt = now; machine.lastActiveAt = now; }
  machine.updatedAt = now;

  await kvSet(kv, `machine:${machineId}`, machine);

  const machines = await getMachinesList(kv, userId);
  const idx = machines.findIndex(m => m.id === machineId);
  if (idx !== -1) { machines[idx] = machine; await saveMachinesList(kv, userId, machines); }

  return jsonR({ success: true, machine });
}

async function handleDeleteMachine(request, env, machineId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  const machine = await kvGet(kv, `machine:${machineId}`);
  if (!machine || machine.accountId !== userId) return jsonR({ error: 'Not found' }, 404);
  await kv.delete(`machine:${machineId}`);
  const machines = await getMachinesList(kv, userId);
  await saveMachinesList(kv, userId, machines.filter(m => m.id !== machineId));
  return jsonR({ success: true });
}

// ─── Push tokens ──────────────────────────────────────────────────────────────

async function handleGetPushTokens(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const tokens = (await kvGet(env.NASTECH_KV, `push_tokens:${userId}`)) || [];
  return jsonR({ tokens });
}

async function handleRegisterPushToken(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { token } = body;
  if (!token) return jsonR({ error: 'Missing token' }, 400);
  const kv = env.NASTECH_KV;
  const tokens = (await kvGet(kv, `push_tokens:${userId}`)) || [];
  const now = Date.now();
  const existing = tokens.find(t => t.token === token);
  if (!existing) {
    tokens.push({ id: crypto.randomUUID(), token, createdAt: now, updatedAt: now });
    await kvSet(kv, `push_tokens:${userId}`, tokens);
  } else {
    existing.updatedAt = now;
    await kvSet(kv, `push_tokens:${userId}`, tokens);
  }
  return jsonR({ success: true });
}

async function handleDeletePushToken(request, env, token) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  const tokens = (await kvGet(kv, `push_tokens:${userId}`)) || [];
  await kvSet(kv, `push_tokens:${userId}`, tokens.filter(t => t.token !== token));
  return jsonR({ success: true });
}

// ─── Expo Push Dispatch ───────────────────────────────────────────────────────

async function sendExpoNotifications(messages) {
  if (!messages.length) return [];
  const results = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const resp = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (!resp.ok) {
        results.push(...batch.map(() => ({ status: 'error', message: `HTTP ${resp.status}` })));
        continue;
      }
      const data = await resp.json();
      results.push(...(data.data || batch.map(() => ({ status: 'error', message: 'No data' }))));
    } catch (err) {
      results.push(...batch.map(() => ({ status: 'error', message: 'Network error' })));
    }
  }
  return results;
}

async function handleSessionPushEvent(request, env, sessionId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { kind, title, body: pushBody, data } = body;
  if (!kind || !title || !pushBody) return jsonR({ error: 'Missing fields: kind, title, body' }, 400);

  const kv = env.NASTECH_KV;

  // Verify session belongs to user
  const session = await kvGet(kv, `session:${sessionId}`);
  if (!session || session.accountId !== userId) return jsonR({ error: 'Session not found' }, 404);

  // Get push tokens
  const tokenObjs = (await kvGet(kv, `push_tokens:${userId}`)) || [];
  if (tokenObjs.length === 0) return jsonR({ success: true }); // No tokens, nothing to do

  const messages = tokenObjs.map(t => ({
    to: t.token || t,
    title,
    body: pushBody,
    data: { sessionId, ...(data ?? {}), kind },
    sound: 'default',
    channelId: 'messages',
  }));

  const tickets = await sendExpoNotifications(messages);

  // Remove any DeviceNotRegistered tokens
  let changed = false;
  const validTokens = tokenObjs.filter((t, i) => {
    const ticket = tickets[i];
    if (ticket && ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) await kvSet(kv, `push_tokens:${userId}`, validTokens);

  return jsonR({ success: true });
}

// ─── V3 Messages ─────────────────────────────────────────────────────────────

async function handleGetMessages(request, env, sessionId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const session = await kvGet(env.NASTECH_KV, `session:${sessionId}`);
  if (!session || session.accountId !== userId) return jsonR({ error: 'Not found' }, 404);

  const url = new URL(request.url);
  const afterSeq = parseInt(url.searchParams.get('after_seq') || '0');
  const beforeSeq = url.searchParams.get('before_seq') ? parseInt(url.searchParams.get('before_seq')) : null;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  const allMessages = (await kvGet(env.NASTECH_KV, `session_messages:${sessionId}`)) || [];

  let messages;
  if (beforeSeq !== null) {
    messages = allMessages.filter(m => m.seq < beforeSeq).sort((a, b) => b.seq - a.seq).slice(0, limit).reverse();
  } else {
    messages = allMessages.filter(m => m.seq > afterSeq).sort((a, b) => a.seq - b.seq).slice(0, limit);
  }

  return jsonR({ messages });
}

async function handleSendMessages(request, env, sessionId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const kv = env.NASTECH_KV;
  const session = await kvGet(kv, `session:${sessionId}`);
  if (!session || session.accountId !== userId) return jsonR({ error: 'Not found' }, 404);

  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const { messages: toSend } = body;
  if (!Array.isArray(toSend) || toSend.length === 0) return jsonR({ error: 'No messages' }, 400);

  const allMessages = (await kvGet(kv, `session_messages:${sessionId}`)) || [];
  const now = Date.now();
  let seq = (allMessages.length > 0 ? Math.max(...allMessages.map(m => m.seq)) : 0);

  const created = toSend.map(msg => {
    seq++;
    return { id: crypto.randomUUID(), seq, content: msg.content, localId: msg.localId || null, createdAt: now, updatedAt: now };
  });

  allMessages.push(...created);
  // Keep last 5000 messages
  const trimmed = allMessages.sort((a, b) => a.seq - b.seq).slice(-5000);
  await kvSet(kv, `session_messages:${sessionId}`, trimmed);

  return jsonR({ messages: created.map(m => ({ id: m.id, seq: m.seq, localId: m.localId, createdAt: m.createdAt, updatedAt: m.updatedAt })) });
}

// ─── Artifacts ───────────────────────────────────────────────────────────────

async function handleGetArtifacts(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const artifacts = (await kvGet(env.NASTECH_KV, `artifacts:${userId}`)) || [];
  return jsonR({ artifacts });
}

// ─── User routes ──────────────────────────────────────────────────────────────

async function handleGetUser(request, env, targetUserId) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const publicKeyHex = await env.NASTECH_KV.get(`account_id:${targetUserId}`);
  if (!publicKeyHex) return jsonR({ error: 'User not found' }, 404);
  const account = await kvGet(env.NASTECH_KV, `account:${publicKeyHex}`);
  if (!account) return jsonR({ error: 'User not found' }, 404);
  return jsonR({ id: targetUserId, username: account.username || null, firstName: account.firstName || null, lastName: account.lastName || null, avatar: null });
}

// ─── Feed ─────────────────────────────────────────────────────────────────────

async function handleGetFeed(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  return jsonR({ items: [] });
}

// ─── Access keys ──────────────────────────────────────────────────────────────

async function handleGetAccessKeys(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  const keys = (await kvGet(env.NASTECH_KV, `access_keys:${userId}`)) || [];
  return jsonR({ keys });
}

async function handleCreateAccessKey(request, env) {
  const userId = await requireAuth(request, env);
  if (!userId) return jsonR({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return jsonR({ error: 'Invalid JSON' }, 400); }
  const kv = env.NASTECH_KV;
  const keys = (await kvGet(kv, `access_keys:${userId}`)) || [];
  const newKey = { id: crypto.randomUUID(), name: body.name || 'Access Key', key: randomId(32), createdAt: new Date().toISOString() };
  keys.push(newKey);
  await kvSet(kv, `access_keys:${userId}`, keys);
  return jsonR({ key: newKey });
}

// ─── Socket.IO WebSocket (/v1/updates) ───────────────────────────────────────

function parseSioPacket(raw) {
  if (!raw || raw.length < 2) return null;
  const eioType = raw[0];
  const sioType = raw[1];
  let rest = raw.slice(2);
  let ackId = null;
  const ackMatch = rest.match(/^(\d+)([\[{].*)/s);
  if (ackMatch) { ackId = ackMatch[1]; rest = ackMatch[2]; }
  let data = null;
  if (rest) { try { data = JSON.parse(rest); } catch {} }
  return { eioType, sioType, ackId, data };
}

async function sendInitialState(ws, kv, userId) {
  // Send machine updates so app knows about registered machines
  const machines = (await kvGet(kv, `machines_list:${userId}`)) || [];
  for (const machine of machines) {
    try { ws.send(`42["machine-update",${JSON.stringify(machine)}]`); } catch {}
  }
}

async function handleSocketIO(request, env) {
  const upgrade = request.headers.get('Upgrade');
  if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426, headers: corsHeaders() });
  }

  const pair = new WebSocketPair();
  const [client, server] = Object.values(pair);
  server.accept();

  const sid = randomId(12);
  let userId = null;
  let clientType = 'user-scoped';
  let machineId = null;
  let authenticated = false;

  // EIO OPEN packet
  server.send(`0{"sid":"${sid}","upgrades":[],"pingInterval":25000,"pingTimeout":20000,"maxPayload":1000000}`);

  server.addEventListener('message', async (event) => {
    const raw = typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data);
    if (!raw) return;

    // EIO PING (2) → PONG (3)
    if (raw === '2') { server.send('3'); return; }

    const pkt = parseSioPacket(raw);
    if (!pkt) return;

    // Only handle EIO MESSAGE (4)
    if (pkt.eioType !== '4') return;

    // Socket.IO CONNECT (40...)
    if (pkt.sioType === '0') {
      const auth = pkt.data || {};
      const token = auth.token;
      clientType = auth.clientType || 'user-scoped';
      machineId = auth.machineId || null;

      if (!token) {
        server.send('44[{"message":"Missing token","data":{"type":"UnauthorizedError"}}]');
        server.close(1008, 'Unauthorized');
        return;
      }

      userId = await verifyToken(token, getSecret(env));
      if (!userId) {
        server.send('44[{"message":"Invalid token","data":{"type":"UnauthorizedError"}}]');
        server.close(1008, 'Invalid token');
        return;
      }

      authenticated = true;

      // Socket.IO namespace CONNECTED
      server.send(`40{"sid":"${sid}"}`);

      // Send initial state to user-scoped clients
      if (clientType === 'user-scoped') {
        await sendInitialState(server, env.NASTECH_KV, userId);
      }

      // If machine-scoped: mark machine online
      if ((clientType === 'machine-scoped' || clientType === 'session-scoped') && machineId) {
        const kv = env.NASTECH_KV;
        const machine = await kvGet(kv, `machine:${machineId}`);
        if (machine && machine.accountId === userId) {
          machine.active = true;
          machine.activeAt = Date.now();
          machine.lastActiveAt = Date.now();
          await kvSet(kv, `machine:${machineId}`, machine);
        }
      }
      return;
    }

    if (!authenticated) return;

    // Socket.IO EVENT (42...) with or without ack
    if (pkt.sioType === '2') {
      const arr = Array.isArray(pkt.data) ? pkt.data : [];
      const [eventName, eventData] = arr;

      if (eventName === 'rpc-call') {
        const ackId = pkt.ackId;
        const response = JSON.stringify({ ok: false, error: 'RPC not available in edge mode' });
        if (ackId !== null && ackId !== undefined) {
          server.send(`43${ackId}[${response}]`);
        }
        return;
      }

      if (eventName === 'app-state') return; // Ignore

      if (eventName === 'machine-update' && eventData && machineId) {
        // CLI daemon sent a machine update → store in KV
        const kv = env.NASTECH_KV;
        const machine = await kvGet(kv, `machine:${machineId}`);
        if (machine && machine.accountId === userId) {
          if (eventData.metadata) { machine.metadata = eventData.metadata; machine.metadataVersion = (machine.metadataVersion || 0) + 1; }
          if (eventData.daemonState) { machine.daemonState = eventData.daemonState; machine.daemonStateVersion = (machine.daemonStateVersion || 0) + 1; }
          machine.updatedAt = Date.now();
          await kvSet(kv, `machine:${machineId}`, machine);
          const machines = await getMachinesList(kv, userId);
          const idx = machines.findIndex(m => m.id === machineId);
          if (idx !== -1) { machines[idx] = machine; await saveMachinesList(kv, userId, machines); }
        }
        return;
      }

      if (eventName === 'session-update' && eventData) {
        // CLI sent a session update → store in KV
        const kv = env.NASTECH_KV;
        const sessionId = eventData.id;
        if (sessionId) {
          const session = await kvGet(kv, `session:${sessionId}`);
          if (session && session.accountId === userId) {
            if (eventData.metadata) { session.metadata = eventData.metadata; session.metadataVersion = (session.metadataVersion || 0) + 1; }
            if (eventData.agentState !== undefined) { session.agentState = eventData.agentState; session.agentStateVersion = (session.agentStateVersion || 0) + 1; }
            if (eventData.active !== undefined) session.active = eventData.active;
            session.updatedAt = Date.now();
            session.seq = Date.now();
            await kvSet(kv, `session:${sessionId}`, session);
            const sessions = await getSessionsList(kv, userId);
            const idx = sessions.findIndex(s => s.id === sessionId);
            if (idx !== -1) { sessions[idx] = session; sessions.sort((a, b) => b.updatedAt - a.updatedAt); await saveSessionsList(kv, userId, sessions); }
          }
        }
        return;
      }

      if (eventName === 'ping') {
        const ackId = pkt.ackId;
        if (ackId !== null && ackId !== undefined) {
          server.send(`43${ackId}[{"pong":true}]`);
        }
        return;
      }
      return;
    }
  });

  server.addEventListener('close', async () => {
    // Mark machine offline on disconnect
    if (authenticated && userId && (clientType === 'machine-scoped' || clientType === 'session-scoped') && machineId) {
      try {
        const kv = env.NASTECH_KV;
        const machine = await kvGet(kv, `machine:${machineId}`);
        if (machine && machine.accountId === userId) {
          machine.active = false;
          machine.updatedAt = Date.now();
          await kvSet(kv, `machine:${machineId}`, machine);
        }
      } catch {}
    }
  });

  server.addEventListener('error', () => {});

  return new Response(null, { status: 101, webSocket: client });
}

// ─── Version ──────────────────────────────────────────────────────────────────

function handleVersion() {
  return jsonR({ version: '1.1.0', minCliVersion: '1.0.0', latestCliVersion: '1.1.0' });
}

// ─── Main Router ──────────────────────────────────────────────────────────────

function matchPath(path, pattern) {
  const patParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (patParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (method === 'OPTIONS') return cors204();

    // Health / Root
    if (path === '/' || path === '/health') {
      return jsonR({ status: 'ok', service: 'NasTech API', version: '1.1.0', kv: env.NASTECH_KV ? 'connected' : 'not configured' });
    }
    if (path === '/v1/health') {
      return jsonR({ status: 'ok', service: 'NasTech API', version: '1.1.0' });
    }

    // Version
    if (method === 'GET' && (path === '/v1/version' || path === '/v1/versions')) return handleVersion();

    // Auth
    if (method === 'POST' && path === '/v1/auth') return handleAuth(request, env);
    if (method === 'POST' && path === '/v1/auth/request') return handleAuthRequest(request, env);
    if (method === 'GET'  && path === '/v1/auth/request/status') return handleAuthRequestStatus(request, env);
    if (method === 'POST' && path === '/v1/auth/response') return handleAuthResponse(request, env);
    if (method === 'POST' && path === '/v1/auth/account/request') return handleAccountAuthRequest(request, env);
    if (method === 'POST' && path === '/v1/auth/account/response') return handleAccountAuthResponse(request, env);

    // Account
    if (method === 'GET'  && path === '/v1/account/profile') return handleGetProfile(request, env);
    if (method === 'POST' && path === '/v1/account/profile') return handleUpdateProfile(request, env);
    if (method === 'GET'  && path === '/v1/account/settings') return handleGetSettings(request, env);
    if (method === 'POST' && path === '/v1/account/settings') return handleUpdateSettings(request, env);

    // KV
    if (method === 'GET'  && path === '/v1/kv') return handleKvGet(request, env);
    if (method === 'POST' && path === '/v1/kv') return handleKvSet(request, env);
    if (method === 'GET'  && path === '/v1/kv/bulk') return handleKvBulkGet(request, env);

    // Sessions
    if (method === 'GET'  && path === '/v1/sessions') return handleGetSessions(request, env);
    if (method === 'POST' && path === '/v1/sessions') return handleCreateSession(request, env);
    let m;
    if ((m = matchPath(path, '/v1/sessions/:id'))) {
      if (method === 'GET')    return handleGetSession(request, env, m.id);
      if (method === 'PUT' || method === 'PATCH') return handleUpdateSession(request, env, m.id);
      if (method === 'DELETE') return handleDeleteSession(request, env, m.id);
    }
    if ((m = matchPath(path, '/v1/sessions/:id/update')) && method === 'POST') return handleUpdateSession(request, env, m.id);
    if ((m = matchPath(path, '/v1/sessions/:id/push-event')) && method === 'POST') return handleSessionPushEvent(request, env, m.id);

    // Machines
    if (method === 'GET'  && path === '/v1/machines') return handleGetMachines(request, env);
    if (method === 'POST' && path === '/v1/machines') return handleCreateMachine(request, env);
    if ((m = matchPath(path, '/v1/machines/:id'))) {
      if (method === 'GET')    return handleGetMachine(request, env, m.id);
      if (method === 'PUT' || method === 'PATCH') return handleUpdateMachine(request, env, m.id);
      if (method === 'DELETE') return handleDeleteMachine(request, env, m.id);
    }

    // Push tokens
    if (method === 'GET'  && path === '/v1/push-tokens') return handleGetPushTokens(request, env);
    if (method === 'POST' && path === '/v1/push-tokens') return handleRegisterPushToken(request, env);
    if ((m = matchPath(path, '/v1/push-tokens/:token')) && method === 'DELETE') return handleDeletePushToken(request, env, m.token);

    // V3 Messages
    if ((m = matchPath(path, '/v3/sessions/:id/messages'))) {
      if (method === 'GET')  return handleGetMessages(request, env, m.id);
      if (method === 'POST') return handleSendMessages(request, env, m.id);
    }

    // Artifacts
    if (method === 'GET' && path === '/v1/artifacts') return handleGetArtifacts(request, env);

    // Users
    if ((m = matchPath(path, '/v1/users/:id')) && method === 'GET') return handleGetUser(request, env, m.id);

    // Feed
    if (method === 'GET' && path === '/v1/feed') return handleGetFeed(request, env);

    // Access keys
    if (method === 'GET'  && path === '/v1/access-keys') return handleGetAccessKeys(request, env);
    if (method === 'POST' && path === '/v1/access-keys') return handleCreateAccessKey(request, env);

    // Socket.IO WebSocket at /v1/updates (with any trailing path/query)
    if (path.startsWith('/v1/updates')) return handleSocketIO(request, env);

    return jsonR({ error: 'Not found', path }, 404);
  },
};
