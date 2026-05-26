import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config';

describe('config', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.NASTECH_SERVER_URL;
        delete process.env.NASTECH_HOME_DIR;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    describe('defaults', () => {
        it('uses default server URL', () => {
            const config = loadConfig();
            expect(config.serverUrl).toBe('https://api.nastech.workers.dev');
        });

        it('uses default home directory', () => {
            const config = loadConfig();
            expect(config.homeDir).toBe(join(homedir(), '.nastech'));
        });

        it('derives credential path from home directory', () => {
            const config = loadConfig();
            expect(config.credentialPath).toBe(join(homedir(), '.nastech', 'agent.key'));
        });
    });

    describe('env var overrides', () => {
        it('overrides server URL with NASTECH_SERVER_URL', () => {
            process.env.NASTECH_SERVER_URL = 'https://custom-server.example.com';
            const config = loadConfig();
            expect(config.serverUrl).toBe('https://custom-server.example.com');
        });

        it('overrides home directory with NASTECH_HOME_DIR', () => {
            process.env.NASTECH_HOME_DIR = '/tmp/custom-nastech';
            const config = loadConfig();
            expect(config.homeDir).toBe('/tmp/custom-nastech');
        });

        it('derives credential path from overridden home directory', () => {
            process.env.NASTECH_HOME_DIR = '/tmp/custom-nastech';
            const config = loadConfig();
            expect(config.credentialPath).toBe('/tmp/custom-nastech/agent.key');
        });

        it('allows both overrides simultaneously', () => {
            process.env.NASTECH_SERVER_URL = 'https://other.example.com';
            process.env.NASTECH_HOME_DIR = '/opt/nastech';
            const config = loadConfig();
            expect(config.serverUrl).toBe('https://other.example.com');
            expect(config.homeDir).toBe('/opt/nastech');
            expect(config.credentialPath).toBe('/opt/nastech/agent.key');
        });
    });
});
