import type { IntegrationEnvironment } from './integrationEnvironment';

declare global {
    // eslint-disable-next-line no-var
    var __nastechIntegrationEnv: IntegrationEnvironment | undefined;
}

export function getIntegrationEnv(): IntegrationEnvironment {
    if (!globalThis.__nastechIntegrationEnv) {
        throw new Error('No active integration environment');
    }

    return globalThis.__nastechIntegrationEnv;
}
