import { describe, expect, it } from 'vitest'
import { happyHomeDir, happyHomeName } from './app-storage'

describe('NasTech app storage paths', () => {
    it('uses capital NasTech on macOS and Windows', () => {
        expect(happyHomeName('darwin')).toBe('NasTech')
        expect(happyHomeName('win32')).toBe('NasTech')
        expect(happyHomeDir('darwin', '/Users/alice')).toBe('/Users/alice/NasTech')
        expect(happyHomeDir('win32', '/Users/alice')).toBe('/Users/alice/NasTech')
    })

    it('uses lowercase nastech on Linux', () => {
        expect(happyHomeName('linux')).toBe('nastech')
        expect(happyHomeDir('linux', '/home/alice')).toBe('/home/alice/nastech')
    })
})
