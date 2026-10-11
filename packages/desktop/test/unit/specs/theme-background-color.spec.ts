import { describe, it, expect } from 'vitest'
import { getThemeBackgroundColor, normalizeDocumentTheme } from 'common/theme'
describe('Appearance and document theme migration', () => {
  it('paints windows using their appearance', () => {
    expect(getThemeBackgroundColor('dark')).toBe('#282828')
    expect(getThemeBackgroundColor('light')).toBe('#ffffff')
  })
  it('replaces removed palettes with GitHub and keeps supported document themes', () => {
    for (const theme of ['dark', 'graphite', 'nord', 'book', undefined])
      expect(normalizeDocumentTheme(theme)).toBe('github')
    for (const theme of ['github', 'academic', 'liber'])
      expect(normalizeDocumentTheme(theme)).toBe(theme)
    expect(
      normalizeDocumentTheme('custom:test', [
        { id: 'custom:test', name: 'Test', css: '.markdown-body{}' }
      ])
    ).toBe('custom:test')
  })
})
