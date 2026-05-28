import * as os from "os";
import { type Fastify } from "../types";

const startTime = Date.now();

function getDatabaseType(): string {
    const provider = process.env.DB_PROVIDER;
    if (provider === 'pglite') return 'pglite';
    if (process.env.DATABASE_URL) {
        const url = process.env.DATABASE_URL;
        if (url.startsWith('postgres')) return 'postgresql';
        if (url.startsWith('sqlite')) return 'sqlite';
        return 'external';
    }
    return 'postgresql';
}

export function healthRoutes(app: Fastify) {
    app.get('/v1/health', {
        config: { skipAuth: true },
    } as any, async function (_request, reply) {
        const uptimeMs = Date.now() - startTime;
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const h = Math.floor(uptimeSec / 3600);
        const m = Math.floor((uptimeSec % 3600) / 60);
        const s = uptimeSec % 60;
        reply.send({
            status: 'ok',
            service: 'NasTech Server',
            version: '1.0.0',
            uptime: `${h}h ${m}m ${s}s`,
            uptime_ms: uptimeMs,
            database: getDatabaseType(),
            timestamp: new Date().toISOString(),
            system: {
                platform: os.platform(),
                arch: os.arch(),
                node: process.version,
            },
        });
    });
}
