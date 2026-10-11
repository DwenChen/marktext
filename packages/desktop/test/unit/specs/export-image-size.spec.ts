import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn(), app: {} }))
vi.mock('../../../src/main/i18n', () => ({ t: (key: string) => key }))

const { getImageSize } = await import('../../../src/main/utils/exportImage')

describe('long image bitmap limits', () => {
  it('rounds outwards so fractional content bounds are included', () => {
    expect(getImageSize(1200.2, 3000.1)).toEqual({ width: 1201, height: 3001 })
  })

  it.each([
    [0, 1],
    [1, -1],
    [NaN, 100],
    [100, Infinity],
    [100, 32768],
    [3000, 30000],
    [32768, 100]
  ])('rejects invalid or excessive dimensions %s × %s before capture', (width, height) => {
    expect(() => getImageSize(width, height)).toThrow('editor.export.imageTooLarge')
  })
})
