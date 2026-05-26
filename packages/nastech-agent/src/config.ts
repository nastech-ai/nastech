import { homedir } from 'node:os';
import { join } from 'node:path';

export type Config = {
    serverUrl: string;
    homeDir: string;
    credentialPath: string;
};

export function loadConfig(): Config {
    const serverUrl = (process.env.NASTECH_SERVER_URL ?? 'https://api.nastech.workers.dev').replace(/\/+$/, '');
    const homeDir = process.env.NASTECH_HOME_DIR ?? join(homedir(), '.nastech');
    const credentialPath = join(homeDir, 'agent.key');
    return { serverUrl, homeDir, credentialPath };
}
