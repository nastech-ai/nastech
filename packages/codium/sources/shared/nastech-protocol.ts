export type NasTechAuthStatus =
    | 'starting'
    | 'unconfigured'
    | 'authenticating'
    | 'authenticated'
    | 'error'

export type NasTechAuthMethod = 'link-device' | 'create-account' | 'restore-secret'

export interface NasTechAuthFlowSnapshot {
    method: NasTechAuthMethod
    authUrl?: string
    publicKey?: string
    startedAt: number
}

export interface NasTechStateSnapshot {
    status: NasTechAuthStatus
    serverUrl: string
    webappUrl: string
    clientReady: boolean
    accountId?: string
    tokenExpiresAt?: number
    authFlow?: NasTechAuthFlowSnapshot
    error?: string
    updatedAt: number
}

export interface NasTechAuthenticatedClientStatus {
    ready: boolean
    serverUrl: string
    accountId?: string
    anonId?: string
    contentPublicKey?: string
}

export type NasTechWorkerRequest =
    | { kind: 'getState' }
    | { kind: 'createAccount' }
    | { kind: 'startLinkDevice' }
    | { kind: 'restoreSecret'; secretKey: string }
    | { kind: 'cancelAuth' }
    | { kind: 'logout' }
    | { kind: 'clientStatus' }

export type NasTechWorkerRequestWithId = NasTechWorkerRequest & { requestId: string }

export type NasTechWorkerResponse =
    | {
          kind: 'response'
          requestId: string
          ok: true
          state: NasTechStateSnapshot
          value?: unknown
      }
    | {
          kind: 'response'
          requestId: string
          ok: false
          state: NasTechStateSnapshot
          error: string
      }

export type NasTechWorkerStateMessage = {
    kind: 'state'
    state: NasTechStateSnapshot
}

export type NasTechWorkerFatalMessage = {
    kind: 'fatal'
    error: string
}

export type NasTechWorkerMessage =
    | NasTechWorkerResponse
    | NasTechWorkerStateMessage
    | NasTechWorkerFatalMessage
