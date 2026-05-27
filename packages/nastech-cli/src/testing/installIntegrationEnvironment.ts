import { afterAll } from 'vitest';
import {
    applyEnvironmentToProcess,
    createIntegrationEnvironment,
    destroyIntegrationEnvironment,
    type EnvironmentTemplate,
    type IntegrationEnvironment,
} from './integrationEnvironment';

type IntegrationEnvironmentProfile = {
    template: EnvironmentTemplate;
    up: boolean;
};

declare global {
    // eslint-disable-next-line no-var
    var __nastechIntegrationEnv: IntegrationEnvironment | undefined;
}

export async function installIntegrationEnvironment(profile: IntegrationEnvironmentProfile) {
    const previousEnv = {
        NASTECH_SERVER_URL: process.env.NASTECH_SERVER_URL,
        NASTECH_WEBAPP_URL: process.env.NASTECH_WEBAPP_URL,
        NASTECH_HOME_DIR: process.env.NASTECH_HOME_DIR,
        NASTECH_PROJECT_DIR: process.env.NASTECH_PROJECT_DIR,
        NASTECH_VARIANT: process.env.NASTECH_VARIANT,
        DEBUG: process.env.DEBUG,
    };

    const env = await createIntegrationEnvironment(profile);
    applyEnvironmentToProcess(env);
    globalThis.__nastechIntegrationEnv = env;

    afterAll(async () => {
        try {
            await destroyIntegrationEnvironment(env);
        } finally {
            for (const [key, value] of Object.entries(previousEnv)) {
                if (value === undefined) {
                    delete process.env[key];
                } else {
                    process.env[key] = value;
                }
            }

            if (globalThis.__nastechIntegrationEnv?.name === env.name) {
                globalThis.__nastechIntegrationEnv = undefined;
            }
        }
    });
}
