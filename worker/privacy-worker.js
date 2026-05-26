/**
 * NasTech Privacy Policy Worker
 * Cloudflare Worker for privacy.nastech.workers.dev
 */

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NasTech Privacy Policy</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; line-height: 1.6; }
  h1 { color: #007AFF; } h2 { color: #333; margin-top: 32px; }
  a { color: #007AFF; } .updated { color: #666; font-size: 14px; }
  @media (prefers-color-scheme: dark) { body { background: #1c1c1e; color: #f2f2f7; } h1 { color: #0a84ff; } h2 { color: #e5e5ea; } .updated { color: #8e8e93; } }
</style>
</head>
<body>
<h1>NasTech Privacy Policy</h1>
<p class="updated">Last updated: May 2026</p>

<h2>Overview</h2>
<p>NasTech is a privacy-first platform. Your data is end-to-end encrypted before it leaves your device. We cannot read your messages, session content, or any personal data you create.</p>

<h2>What We Collect</h2>
<ul>
  <li><strong>Account identifiers</strong>: A cryptographic public key tied to your device. No email, no phone number.</li>
  <li><strong>Encrypted blobs</strong>: Session data stored on our servers is encrypted with keys only you hold. We store ciphertext we cannot decrypt.</li>
  <li><strong>Push notification tokens</strong>: Used only to deliver encrypted push notifications. The notification content is encrypted.</li>
  <li><strong>Device metadata</strong>: Platform, app version, and hostname for your connected machines (visible only to you).</li>
</ul>

<h2>What We Do NOT Collect</h2>
<ul>
  <li>Message content or conversation data</li>
  <li>API keys or credentials</li>
  <li>Browsing or usage analytics</li>
  <li>Personal identifiers (name, email, phone)</li>
</ul>

<h2>Data Storage</h2>
<p>All session data is end-to-end encrypted using NaCl box encryption (X25519 + XSalsa20-Poly1305). Keys are generated on your device and never transmitted to our servers.</p>

<h2>Third-Party Services</h2>
<p>NasTech integrates with AI providers (Anthropic Claude, OpenAI, Groq, Ollama) when you configure them. Your API keys are stored locally on your device and are never sent to NasTech servers.</p>

<h2>Self-Hosting</h2>
<p>You can self-host the NasTech server. In that case, all data stays on your own infrastructure.</p>

<h2>Contact</h2>
<p>Questions? <a href="https://github.com/nastech-ai/nastech/issues">Open an issue on GitHub</a>.</p>
</body>
</html>`;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    return new Response(PRIVACY_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders() },
    });
  },
};

function corsHeaders() {
  return { 'Access-Control-Allow-Origin': '*' };
}
