import { app, BrowserWindow, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import type {
    NasTechStateSnapshot,
    NasTechWorkerMessage,
    NasTechWorkerRequest,
    NasTechWorkerRequestWithId,
} from '../../../shared/nastech-protocol'
import { storageFilePath } from '../app-storage'

const __dirname = dirname(fileURLToPath(import.meta.url))

type PendingRequest = {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
}

const DEFAULT_SERVER_URL = 'https://api.nastech.workers.dev'
const DEFAULT_WEBAPP_URL = 'https://ba.nastech.workers.dev'

let worker: Worker | null = null
let latestState: NasTechStateSnapshot = {
    status: 'starting',
    serverUrl: process.env.NASTECH_SERVER_URL || DEFAULT_SERVER_URL,
    webappUrl: process.env.NASTECH_WEBAPP_URL || DEFAULT_WEBAPP_URL,
    clientReady: false,
    updatedAt: Date.now(),
}
const pending = new Map<string, PendingRequest>()

function workerEntryPath(): string {
    const p = join(__dirname, 'nastech-worker.js')
    if (!existsSync(p)) {
        // eslint-disable-next-line no-console
        console.error('[nastech-host] worker bundle missing at', p)
    }
    return p
}

function ensureWorker(): Worker {
    if (worker) return worker
    const w = new Worker(workerEntryPath(), {
        workerData: {
            storagePath: storageFilePath('nastech-auth.json'),
            serverUrl: process.env.NASTECH_SERVER_URL || DEFAULT_SERVER_URL,
            webappUrl: process.env.NASTECH_WEBAPP_URL || DEFAULT_WEBAPP_URL,
            clientId: `codium/${app.getVersion() || '0.0.0'}`,
        },
    })
    w.on('message', (msg: NasTechWorkerMessage) => {
        if (msg.kind === 'state') {
            latestState = msg.state
            broadcastState()
            return
        }
        if (msg.kind === 'response') {
            latestState = msg.state
            broadcastState()
            const entry = pending.get(msg.requestId)
            if (!entry) return
            pending.delete(msg.requestId)
            if (msg.ok) {
                entry.resolve({ state: msg.state, value: msg.value })
            } else {
                entry.reject(new Error(msg.error))
            }
            return
        }
        if (msg.kind === 'fatal') {
            // eslint-disable-next-line no-console
            console.error('[nastech-worker] fatal:', msg.error)
        }
    })
    w.on('error', (err) => {
        // eslint-disable-next-line no-console
        console.error('[nastech-worker] error:', err)
        failPending(err.message || 'NasTech worker crashed')
        latestState = {
            ...latestState,
            status: 'error',
            clientReady: false,
            error: err.message || 'NasTech worker crashed',
            updatedAt: Date.now(),
        }
        broadcastState()
        worker = null
    })
    w.on('exit', (code) => {
        if (code !== 0) {
            const message = `NasTech worker exited with code ${code}`
            // eslint-disable-next-line no-console
            console.error('[nastech-worker]', message)
            failPending(message)
            latestState = {
                ...latestState,
                status: 'error',
                clientReady: false,
                error: message,
                updatedAt: Date.now(),
            }
            broadcastState()
        }
        worker = null
    })
    worker = w
    return w
}

function failPending(reason: string): void {
    for (const entry of pending.values()) {
        entry.reject(new Error(reason))
    }
    pending.clear()
}

function broadcastState(): void {
    for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('nastech:state', latestState)
    }
}

function sendRequest(request: NasTechWorkerRequest): Promise<unknown> {
    const requestId = randomUUID()
    const msg: NasTechWorkerRequestWithId = { ...request, requestId }
    const w = ensureWorker()
    return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject })
        w.postMessage(msg)
    })
}

export function registerNasTechIpc(): void {
    ipcMain.handle('nastech:state:get', async () => {
        const result = await sendRequest({ kind: 'getState' }) as { state: NasTechStateSnapshot }
        return result.state
    })
    ipcMain.handle('nastech:create-account', async () => {
        const result = await sendRequest({ kind: 'createAccount' }) as { state: NasTechStateSnapshot }
        return result.state
    })
    ipcMain.handle('nastech:start-link-device', async () => {
        const result = await sendRequest({ kind: 'startLinkDevice' }) as { state: NasTechStateSnapshot }
        return result.state
    })
    ipcMain.handle('nastech:restore-secret', async (_e, secretKey: string) => {
        const result = await sendRequest({ kind: 'restoreSecret', secretKey }) as { state: NasTechStateSnapshot }
        return result.state
    })
    ipcMain.handle('nastech:cancel-auth', async () => {
        const result = await sendRequest({ kind: 'cancelAuth' }) as { state: NasTechStateSnapshot }
        return result.state
    })
    ipcMain.handle('nastech:logout', async () => {
        const result = await sendRequest({ kind: 'logout' }) as { state: NasTechStateSnapshot }
        return result.state
    })
    ipcMain.handle('nastech:client-status', async () => {
        const result = await sendRequest({ kind: 'clientStatus' }) as {
            state: NasTechStateSnapshot
            value?: unknown
        }
        return result.value
    })
    app.on('before-quit', () => {
        try {
            worker?.terminate()
        } catch {
            /* ignored */
        }
        worker = null
    })
}
