import { z } from "zod";
import { type Fastify } from "../types";
import { log } from "@/utils/log";

/**
 * NasTech AI Routes
 * 
 * Provides cloud AI chat completions when the user's PC is offline.
 * Supports multiple providers via user-supplied API keys.
 * Routes: 
 *   POST /v1/ai/chat       — OpenAI-compatible chat completions
 *   GET  /v1/ai/models     — List available models
 *   POST /v1/ai/test       — Test a custom API connection
 */

export function aiRoutes(app: Fastify) {

    app.get('/v1/ai/models', {
        schema: {
            response: {
                200: z.object({
                    object: z.literal('list'),
                    data: z.array(z.object({
                        id: z.string(),
                        object: z.literal('model'),
                        provider: z.string(),
                    }))
                })
            }
        }
    }, async (request, reply) => {
        return {
            object: 'list' as const,
            data: [
                { id: 'claude-3-haiku-20240307', object: 'model' as const, provider: 'anthropic' },
                { id: 'claude-3-5-sonnet-20241022', object: 'model' as const, provider: 'anthropic' },
                { id: 'gpt-4o-mini', object: 'model' as const, provider: 'openai' },
                { id: 'gpt-4o', object: 'model' as const, provider: 'openai' },
                { id: 'llama-3.1-8b-instant', object: 'model' as const, provider: 'groq' },
                { id: 'llama-3.3-70b-versatile', object: 'model' as const, provider: 'groq' },
                { id: 'llama3', object: 'model' as const, provider: 'ollama' },
                { id: 'mistral', object: 'model' as const, provider: 'ollama' },
            ]
        };
    });

    app.post('/v1/ai/chat', {
        schema: {
            body: z.object({
                messages: z.array(z.object({
                    role: z.enum(['system', 'user', 'assistant']),
                    content: z.string(),
                })),
                model: z.string().optional(),
                provider: z.enum(['anthropic', 'openai', 'groq', 'ollama', 'custom']).optional(),
                api_key: z.string().optional(),
                base_url: z.string().optional(),
                max_tokens: z.number().optional(),
                temperature: z.number().optional(),
                stream: z.boolean().optional().default(false),
            }),
        }
    }, async (request, reply) => {
        const { messages, model, provider = 'anthropic', api_key, base_url, max_tokens = 1024, temperature = 0.7 } = request.body;

        // Get API key from header or body
        const apiKey = request.headers['x-nastech-api-key'] as string | undefined || api_key;
        const customBaseUrl = request.headers['x-nastech-base-url'] as string | undefined || base_url;

        if (!apiKey && provider !== 'ollama') {
            return reply.code(400).send({ error: 'API key required. Set x-nastech-api-key header or api_key in body.' });
        }

        try {
            switch (provider) {
                case 'anthropic':
                    return await callAnthropic(reply, messages, model || 'claude-3-haiku-20240307', apiKey!, max_tokens);
                case 'openai':
                    return await callOpenAI(reply, messages, model || 'gpt-4o-mini', apiKey!, 'https://api.openai.com', max_tokens, temperature);
                case 'groq':
                    return await callOpenAI(reply, messages, model || 'llama-3.1-8b-instant', apiKey!, 'https://api.groq.com/openai', max_tokens, temperature);
                case 'ollama':
                    return await callOllama(reply, messages, model || 'llama3', customBaseUrl || 'http://localhost:11434');
                case 'custom':
                    if (!customBaseUrl) return reply.code(400).send({ error: 'base_url required for custom provider' });
                    return await callOpenAI(reply, messages, model || 'default', apiKey!, customBaseUrl, max_tokens, temperature);
                default:
                    return reply.code(400).send({ error: `Unknown provider: ${provider}` });
            }
        } catch (err: any) {
            log({ module: 'ai-routes', level: 'error' }, `AI chat error: ${err.message}`);
            return reply.code(500).send({ error: err.message || 'AI request failed' });
        }
    });

    app.post('/v1/ai/test', {
        schema: {
            body: z.object({
                provider: z.enum(['anthropic', 'openai', 'groq', 'ollama', 'custom']),
                api_key: z.string().optional(),
                base_url: z.string().optional(),
                model: z.string().optional(),
            })
        }
    }, async (request, reply) => {
        const { provider, api_key, base_url, model } = request.body;
        const testMessages = [{ role: 'user' as const, content: 'Say "ok" in one word.' }];

        try {
            let result: any;
            switch (provider) {
                case 'anthropic':
                    result = await callAnthropic(reply, testMessages, model || 'claude-3-haiku-20240307', api_key!, 100);
                    break;
                case 'openai':
                    result = await callOpenAI(reply, testMessages, model || 'gpt-4o-mini', api_key!, 'https://api.openai.com', 100, 0.5);
                    break;
                case 'groq':
                    result = await callOpenAI(reply, testMessages, model || 'llama-3.1-8b-instant', api_key!, 'https://api.groq.com/openai', 100, 0.5);
                    break;
                case 'ollama':
                    result = await callOllama(reply, testMessages, model || 'llama3', base_url || 'http://localhost:11434');
                    break;
                case 'custom':
                    if (!base_url) return reply.code(400).send({ error: 'base_url required for custom provider' });
                    result = await callOpenAI(reply, testMessages, model || 'default', api_key!, base_url, 100, 0.5);
                    break;
            }
            return reply.send({ success: true, provider });
        } catch (err: any) {
            return reply.send({ success: false, error: err.message });
        }
    });
}

async function callAnthropic(reply: any, messages: any[], model: string, apiKey: string, maxTokens: number) {
    const system = messages.find(m => m.role === 'system')?.content;
    const nonSystem = messages.filter(m => m.role !== 'system');

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            messages: nonSystem,
            ...(system ? { system } : {}),
        }),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Anthropic error ${resp.status}: ${err}`);
    }

    const data: any = await resp.json();
    return reply.send({
        id: data.id,
        object: 'chat.completion',
        model: data.model,
        choices: [{
            index: 0,
            message: { role: 'assistant', content: data.content?.[0]?.text || '' },
            finish_reason: data.stop_reason || 'stop',
        }],
        usage: data.usage || {},
    });
}

async function callOpenAI(reply: any, messages: any[], model: string, apiKey: string, baseUrl: string, maxTokens: number, temperature: number) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${cleanBase}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`${baseUrl} error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    return reply.send(data);
}

async function callOllama(reply: any, messages: any[], model: string, baseUrl: string) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const resp = await fetch(`${cleanBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Ollama error ${resp.status}: ${err}`);
    }

    const data: any = await resp.json();
    return reply.send({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        model: data.model || model,
        choices: [{
            index: 0,
            message: data.message || { role: 'assistant', content: '' },
            finish_reason: data.done ? 'stop' : 'length',
        }],
    });
}
