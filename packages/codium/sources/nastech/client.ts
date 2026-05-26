import { useSyncExternalStore } from 'react'
import type {
    NasTechAuthenticatedClientStatus,
    NasTechStateSnapshot,
} from '@/shared/nastech-protocol'

const initialState: NasTechStateSnapshot = {
    status: 'starting',
    serverUrl: '',
    webappUrl: '',
    clientReady: false,
    updatedAt: Date.now(),
}

let snapshot = initialState
let unsubscribeIpc: (() => void) | null = null
let initialized = false
const listeners = new Set<() => void>()

function emit(next: NasTechStateSnapshot): void {
    snapshot = next
    for (const listener of listeners) listener()
}

function setError(message: string): void {
    emit({
        ...snapshot,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
    })
}

function ensureStarted(): void {
    if (initialized) return
    initialized = true
    try {
        unsubscribeIpc = window.nastech.onState(emit)
        void window.nastech.getState().then(emit).catch((err) => {
            setError(err instanceof Error ? err.message : String(err))
        })
    } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
    }
}

export const nasTechClient = {
    start(): void {
        ensureStarted()
    },
    getSnapshot(): NasTechStateSnapshot {
        return snapshot
    },
    subscribe(listener: () => void): () => void {
        ensureStarted()
        listeners.add(listener)
        return () => {
            listeners.delete(listener)
            if (listeners.size === 0 && unsubscribeIpc) {
                unsubscribeIpc()
                unsubscribeIpc = null
                initialized = false
            }
        }
    },
    async createAccount(): Promise<NasTechStateSnapshot> {
        ensureStarted()
        const next = await window.nastech.createAccount()
        emit(next)
        return next
    },
    async startLinkDevice(): Promise<NasTechStateSnapshot> {
        ensureStarted()
        const next = await window.nastech.startLinkDevice()
        emit(next)
        return next
    },
    async restoreSecret(secretKey: string): Promise<NasTechStateSnapshot> {
        ensureStarted()
        const next = await window.nastech.restoreSecret(secretKey)
        emit(next)
        return next
    },
    async cancelAuth(): Promise<NasTechStateSnapshot> {
        ensureStarted()
        const next = await window.nastech.cancelAuth()
        emit(next)
        return next
    },
    async logout(): Promise<NasTechStateSnapshot> {
        ensureStarted()
        const next = await window.nastech.logout()
        emit(next)
        return next
    },
    async clientStatus(): Promise<NasTechAuthenticatedClientStatus> {
        ensureStarted()
        return window.nastech.clientStatus()
    },
}

export function useNasTechState(): NasTechStateSnapshot {
    return useSyncExternalStore(
        nasTechClient.subscribe,
        nasTechClient.getSnapshot,
        nasTechClient.getSnapshot,
    )
}
