/**
 * NasTech AI Worker
 * Cloudflare Worker for ai.nastech.workers.dev
 *
 * Provides free AI chat completions via multiple providers:
 * - Cloudflare AI (Workers AI - free tier)
 * - Custom API key (user-provided: OpenAI, Anthropic, Groq, Ollama, etc.)
 *
 * All requests are routed through this worker.
 * Users can override the provider via X-NasTech-Provider header or body params.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        status: 'ok',
        service: 'NasTech AI',
        version: '1.0.0',
        providers: ['workers-ai', 'openai', 'anthropic', 'groq', 'ollama', 'custom'],
      });
    }

    // Chat completions endpoint
    if (url.pathname === '/v1/chat/completions' || url.pathname === '/chat') {
      return handleChat(request, env);
    }

    // Models list
    if (url.pathname === '/v1/models') {
      return jsonResponse({
        object: 'list',
        data: [
          { id: 'nastech-default', object: 'model', owned_by: 'nastech' },
          { id: '@cf/meta/llama-3.1-8b-instruct', object: 'model', owned_by: 'cloudflare' },
          { id: '@cf/mistral/mistral-7b-instruct-v0.1', object: 'model', owned_by: 'cloudflare' },
        ],
      });
    }

    return jsonResponse({ error: 'Not found' }, 404);
  },
};

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const provider = request.headers.get('X-NasTech-Provider') || body.provider || 'workers-ai';
  const customApiKey = request.headers.get('X-NasTech-API-Key') || body.api_key;
  const customBaseUrl = request.headers.get('X-NasTech-Base-URL') || body.base_url;

  // Route to custom provider if user has their own API key
  if (customApiKey && customBaseUrl) {
    return proxyToCustom(body, customApiKey, customBaseUrl);
  }

  // OpenAI-compatible custom provider
  if (provider === 'openai' && customApiKey) {
    return proxyToOpenAI(body, customApiKey, 'https://api.openai.com');
  }

  // Groq (free tier available)
  if (provider === 'groq' && customApiKey) {
    return proxyToOpenAI(body, customApiKey, 'https://api.groq.com/openai');
  }

  // Anthropic
  if (provider === 'anthropic' && customApiKey) {
    return proxyToAnthropic(body, customApiKey);
  }

  // Ollama (local, user-provided base URL)
  if (provider === 'ollama' && customBaseUrl) {
    return proxyToOllama(body, customBaseUrl);
  }

  // Default: Cloudflare Workers AI (free)
  return runWorkersAI(body, env);
}

async function runWorkersAI(body, env) {
  if (!env.AI) {
    return jsonResponse({ error: 'Cloudflare AI binding not configured' }, 503);
  }

  const model = body.model || '@cf/meta/llama-3.1-8b-instruct';
  const messages = body.messages || [];

  try {
    const response = await env.AI.run(model, { messages, stream: false });
    return jsonResponse({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: response.response },
        finish_reason: 'stop',
      }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500);
  }
}

async function proxyToOpenAI(body, apiKey, baseUrl) {
  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return jsonResponse(data, resp.status);
}

async function proxyToAnthropic(body, apiKey) {
  const messages = body.messages || [];
  const system = messages.find(m => m.role === 'system')?.content;
  const nonSystem = messages.filter(m => m.role !== 'system');

  const anthropicBody = {
    model: body.model || 'claude-3-haiku-20240307',
    max_tokens: body.max_tokens || 1024,
    messages: nonSystem,
    ...(system ? { system } : {}),
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(anthropicBody),
  });
  const data = await resp.json();

  // Normalize to OpenAI format
  if (data.content) {
    return jsonResponse({
      id: data.id,
      object: 'chat.completion',
      model: data.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: data.content[0]?.text || '' },
        finish_reason: data.stop_reason || 'stop',
      }],
    });
  }
  return jsonResponse(data, resp.status);
}

async function proxyToOllama(body, baseUrl) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const resp = await fetch(`${cleanBase}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: body.model || 'llama3',
      messages: body.messages,
      stream: false,
    }),
  });
  const data = await resp.json();

  // Normalize Ollama response to OpenAI format
  return jsonResponse({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    model: data.model || body.model,
    choices: [{
      index: 0,
      message: data.message || { role: 'assistant', content: '' },
      finish_reason: data.done ? 'stop' : 'length',
    }],
  });
}

async function proxyToCustom(body, apiKey, baseUrl) {
  const cleanBase = baseUrl.replace(/\/$/, '');
  const resp = await fetch(`${cleanBase}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  return jsonResponse(data, resp.status);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-NasTech-Client, X-NasTech-Provider, X-NasTech-API-Key, X-NasTech-Base-URL',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}
