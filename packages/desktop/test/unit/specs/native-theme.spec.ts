import { describe, it, expect } from 'vitest'
import { getNativeThemeSource } from 'main_renderer/app/nativeTheme'
describe('Interface appearance', () => {
  it('defaults to the system appearance', () => {
    expect(getNativeThemeSource({})).toBe('system')
    expect(getNativeThemeSource({ appearance: 'invalid' })).toBe('system')
  })
  it('uses the explicit light/dark appearance independently of document themes', () => {
    expect(getNativeThemeSource({ appearance: 'light' })).toBe('light')
    expect(getNativeThemeSource({ appearance: 'dark' })).toBe('dark')
    expect(getNativeThemeSource({ appearance: 'system' })).toBe('system')
  })
})
