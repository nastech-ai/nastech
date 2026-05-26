import { nasTechClient } from '@/nastech/client'
import type {
    AuthState,
    Capability,
    Plugin,
    PluginContext,
} from '../types'
import type { NasTechStateSnapshot } from '@/shared/nastech-protocol'

function mapAuth(state: NasTechStateSnapshot): AuthState {
    switch (state.status) {
        case 'authenticated':
            return { status: 'connected', account: state.accountId }
        case 'authenticating':
        case 'starting':
            return { status: 'connecting' }
        case 'error':
            return { status: 'error', message: state.error ?? 'NasTech authentication failed' }
        case 'unconfigured':
            return { status: 'unconfigured' }
    }
}

class NasTechPlugin implements Plugin {
    id = 'nastech'
    name = 'NasTech'
    description = 'Encrypted NasTech account connection for future sync and remote session support.'
    vendor = 'NasTech'
    category = 'integrations' as const
    accent = '#2563eb'

    private auth: AuthState = { status: 'connecting' }
    private capabilities: Capability[] = []
    private unsubscribe: (() => void) | null = null

    async activate(ctx: PluginContext) {
        nasTechClient.start()
        this.auth = mapAuth(nasTechClient.getSnapshot())
        this.unsubscribe = nasTechClient.subscribe(() => {
            this.auth = mapAuth(nasTechClient.getSnapshot())
            ctx.onAuthChanged()
        })
    }

    async connect(_credential: string, ctx: PluginContext): Promise<AuthState> {
        this.auth = { status: 'connecting' }
        ctx.onAuthChanged()
        const next = await nasTechClient.startLinkDevice()
        this.auth = mapAuth(next)
        ctx.onAuthChanged()
        return this.auth
    }

    async disconnect(ctx: PluginContext) {
        await nasTechClient.logout()
        this.auth = mapAuth(nasTechClient.getSnapshot())
        ctx.onAuthChanged()
    }

    getAuthState(): AuthState { return this.auth }
    getCapabilities(): readonly Capability[] { return this.capabilities }

    dispose(): void {
        this.unsubscribe?.()
        this.unsubscribe = null
    }
}

export const nasTechPlugin: Plugin = new NasTechPlugin()
