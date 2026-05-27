import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export function nastechHomeName(platform: NodeJS.Platform = process.platform): 'NasTech' | 'nastech' {
    return platform === 'linux' ? 'nastech' : 'NasTech'
}

export function nastechHomeDir(
    platform: NodeJS.Platform = process.platform,
    homeDir: string = homedir(),
): string {
    return join(homeDir, nastechHomeName(platform))
}

export function ensureNasTechHomeDir(): string {
    const dir = nastechHomeDir()
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    return dir
}

export function stateDatabasePath(): string {
    return join(ensureNasTechHomeDir(), 'state.sqlite')
}

export function workspacesRootDir(): string {
    return join(ensureNasTechHomeDir(), 'workspaces')
}

export function projectWorkspacesDir(projectName: string): string {
    return join(workspacesRootDir(), projectName)
}

export function storageFilePath(filename: string): string {
    return join(ensureNasTechHomeDir(), filename)
}
