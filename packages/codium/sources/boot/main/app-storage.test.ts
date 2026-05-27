import { describe, expect, it } from 'vitest'
import { nastechHomeDir, nastechHomeName } from './app-storage'

describe('NasTech app storage paths', () => {
    it('uses capital NasTech on macOS and Windows', () => {
        expect(nastechHomeName('darwin')).toBe('NasTech')
        expect(nastechHomeName('win32')).toBe('NasTech')
        expect(nastechHomeDir('darwin', '/Users/alice')).toBe('/Users/alice/NasTech')
        expect(nastechHomeDir('win32', '/Users/alice')).toBe('/Users/alice/NasTech')
    })

    it('uses lowercase nastech on Linux', () => {
        expect(nastechHomeName('linux')).toBe('nastech')
        expect(nastechHomeDir('linux', '/home/alice')).toBe('/home/alice/nastech')
    })
})
