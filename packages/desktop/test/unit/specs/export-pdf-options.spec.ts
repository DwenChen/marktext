import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ BrowserWindow: vi.fn(), app: {} }))

const { getPdfPageDimensionsMm, getPdfPrintOptions } = await import(
  '../../../src/main/utils/exportPdf'
)
const { buildExportLayoutScript } = await import('../../../src/main/utils/exportLayout')

describe('PDF page dimension and printToPDF option mapping', () => {
  it('resolves standard paper sizes and flips dimensions in landscape', () => {
    expect(getPdfPageDimensionsMm({ pageSize: 'A4', isLandscape: false })).toEqual({
      widthMm: 210,
      heightMm: 297
    })
    expect(getPdfPageDimensionsMm({ pageSize: 'A4', isLandscape: true })).toEqual({
      widthMm: 297,
      heightMm: 210
    })
    expect(getPdfPageDimensionsMm({ pageSize: 'Letter' })).toEqual({
      widthMm: 215.9,
      heightMm: 279.4
    })
  })

  it('converts custom page dimensions and margins from millimetres to inches', () => {
    const opts = getPdfPrintOptions({
      pageSize: 'custom',
      pageSizeWidth: 210,
      pageSizeHeight: 297,
      isLandscape: false,
      pageMarginTop: 20,
      pageMarginRight: 15,
      pageMarginBottom: 20,
      pageMarginLeft: 15
    })

    expect(opts.printBackground).toBe(true)
    expect(opts.generateTaggedPDF).toBe(true)
    expect(opts.generateDocumentOutline).toBe(true)
    expect(opts.landscape).toBe(false)
    expect(opts.pageSize).toEqual({
      width: 210 / 25.4,
      height: 297 / 25.4
    })
    expect(opts.margins).toEqual({
      top: 20 / 25.4,
      right: 15 / 25.4,
      bottom: 20 / 25.4,
      left: 15 / 25.4
    })
  })

  it('passes valid standard pageSize names unchanged and omits margins when unspecified', () => {
    const opts = getPdfPrintOptions({ pageSize: 'A3', isLandscape: true })
    expect(opts.pageSize).toBe('A3')
    expect(opts.landscape).toBe(true)
    expect(opts.margins).toBeUndefined()
  })

  it('builds a syntactically valid layout optimization script for both PDF and PNG modes', () => {
    const pdfScript = buildExportLayoutScript({ mode: 'pdf', pageWidthPx: 680, pageHeightPx: 970 })
    const pngScript = buildExportLayoutScript({ mode: 'png', pageWidthPx: 1128 })

    expect(() => new Function(pdfScript)).not.toThrow()
    expect(() => new Function(pngScript)).not.toThrow()
    expect(pdfScript).toContain('document.fonts.ready')
    expect(pdfScript).toContain('"mode":"pdf"')
    expect(pngScript).toContain('"mode":"png"')
  })
})
