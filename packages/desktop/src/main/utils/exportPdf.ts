import { BrowserWindow, app } from 'electron'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { buildExportLayoutScript } from './exportLayout'

export interface PdfPageOptions {
  pageSize?: string
  pageSizeWidth?: number
  pageSizeHeight?: number
  isLandscape?: boolean
  pageMarginTop?: number
  pageMarginRight?: number
  pageMarginBottom?: number
  pageMarginLeft?: number
}

const MM_PER_INCH = 25.4
const CSS_PX_PER_INCH = 96

const STANDARD_PAGE_SIZES_MM: Record<string, { widthMm: number; heightMm: number }> = {
  A3: { widthMm: 297, heightMm: 420 },
  A4: { widthMm: 210, heightMm: 297 },
  A5: { widthMm: 148, heightMm: 210 },
  Legal: { widthMm: 215.9, heightMm: 355.6 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
  Tabloid: { widthMm: 279.4, heightMm: 431.8 }
}

const VALID_STANDARD_PAGE_SIZES = new Set<string>([
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'A5',
  'A6',
  'Legal',
  'Letter',
  'Tabloid',
  'Ledger'
])

const sanitizeMarginMm = (value: unknown, fallback: number): number => {
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num) || num < 0) return fallback
  return Math.min(100, num)
}

export const getPdfPageDimensionsMm = (
  options?: PdfPageOptions
): { widthMm: number; heightMm: number } => {
  const isLandscape = !!options?.isLandscape
  let widthMm = STANDARD_PAGE_SIZES_MM.A4.widthMm
  let heightMm = STANDARD_PAGE_SIZES_MM.A4.heightMm

  if (
    options?.pageSize === 'custom' &&
    typeof options.pageSizeWidth === 'number' &&
    typeof options.pageSizeHeight === 'number' &&
    options.pageSizeWidth > 0 &&
    options.pageSizeHeight > 0
  ) {
    widthMm = options.pageSizeWidth
    heightMm = options.pageSizeHeight
  } else if (options?.pageSize && STANDARD_PAGE_SIZES_MM[options.pageSize]) {
    widthMm = STANDARD_PAGE_SIZES_MM[options.pageSize].widthMm
    heightMm = STANDARD_PAGE_SIZES_MM[options.pageSize].heightMm
  }

  return isLandscape ? { widthMm: heightMm, heightMm: widthMm } : { widthMm, heightMm }
}

export const getPdfPrintOptions = (options?: PdfPageOptions): Electron.PrintToPDFOptions => {
  // Build a clickable bookmark/outline tree from the document's h1-h6
  // headings so exported PDFs have a navigation pane (#2989). The outline
  // is derived from the tagged-PDF structure tree, so generateTaggedPDF is
  // required — generateDocumentOutline alone produces no outline.
  const pdfOptions: Electron.PrintToPDFOptions = {
    printBackground: true,
    generateTaggedPDF: true,
    generateDocumentOutline: true,
    landscape: !!options?.isLandscape
  }

  const pageSize = options?.pageSize
  if (
    pageSize === 'custom' &&
    typeof options?.pageSizeWidth === 'number' &&
    typeof options?.pageSizeHeight === 'number' &&
    options.pageSizeWidth > 0 &&
    options.pageSizeHeight > 0
  ) {
    // Electron's printToPDF expects custom pageSize dimensions in inches (not microns).
    pdfOptions.pageSize = {
      width: options.pageSizeWidth / MM_PER_INCH,
      height: options.pageSizeHeight / MM_PER_INCH
    }
  } else if (pageSize && VALID_STANDARD_PAGE_SIZES.has(pageSize)) {
    pdfOptions.pageSize = pageSize as Electron.PrintToPDFOptions['pageSize']
  }

  const hasExplicitMargins =
    options?.pageMarginTop !== undefined ||
    options?.pageMarginRight !== undefined ||
    options?.pageMarginBottom !== undefined ||
    options?.pageMarginLeft !== undefined

  if (hasExplicitMargins) {
    const topMm = sanitizeMarginMm(options?.pageMarginTop, 20)
    const rightMm = sanitizeMarginMm(options?.pageMarginRight, 15)
    const bottomMm = sanitizeMarginMm(options?.pageMarginBottom, 20)
    const leftMm = sanitizeMarginMm(options?.pageMarginLeft, 15)
    pdfOptions.margins = {
      top: topMm / MM_PER_INCH,
      right: rightMm / MM_PER_INCH,
      bottom: bottomMm / MM_PER_INCH,
      left: leftMm / MM_PER_INCH
    }
  }

  return pdfOptions
}

export const renderPdf = async(html: string, pageOptions?: PdfPageOptions): Promise<Buffer> => {
  const { widthMm, heightMm } = getPdfPageDimensionsMm(pageOptions)
  const topMm = sanitizeMarginMm(pageOptions?.pageMarginTop, 20)
  const rightMm = sanitizeMarginMm(pageOptions?.pageMarginRight, 15)
  const bottomMm = sanitizeMarginMm(pageOptions?.pageMarginBottom, 20)
  const leftMm = sanitizeMarginMm(pageOptions?.pageMarginLeft, 15)

  const printableWidthPx = Math.max(
    240,
    Math.round(((widthMm - leftMm - rightMm) / MM_PER_INCH) * CSS_PX_PER_INCH)
  )
  const printableHeightPx = Math.max(
    240,
    Math.round(((heightMm - topMm - bottomMm) / MM_PER_INCH) * CSS_PX_PER_INCH)
  )

  const directory = await mkdtemp(path.join(app.getPath('temp'), 'marktext-pdf-'))
  const win = new BrowserWindow({
    show: false,
    width: printableWidthPx,
    height: printableHeightPx,
    useContentSize: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      offscreen: true
    }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    const source = html
      .replace(
        '<head>',
        `<head>
      <meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'">`
      )
      .replace(
        '</head>',
        `<style>
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: auto !important;
          background: #ffffff !important;
        }
        body article.markdown-body {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
      </style></head>`
      )
    const filename = path.join(directory, 'document.html')
    await writeFile(filename, source, 'utf8')

    const printTask = async(): Promise<Buffer> => {
      await win.loadFile(filename)
      const debuggerClient = win.webContents.debugger
      debuggerClient.attach('1.3')
      await debuggerClient.sendCommand('Emulation.setEmulatedMedia', { media: 'print' })
      await debuggerClient.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: printableWidthPx,
        height: printableHeightPx,
        deviceScaleFactor: 1,
        mobile: false
      })

      await win.webContents.executeJavaScript(
        buildExportLayoutScript({
          mode: 'pdf',
          pageWidthPx: printableWidthPx,
          pageHeightPx: printableHeightPx
        })
      )

      const pdfOptions = getPdfPrintOptions(pageOptions)
      return await win.webContents.printToPDF(pdfOptions)
    }

    return await Promise.race([
      printTask(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('PDF export timed out')), 60000)
      })
    ])
  } finally {
    clearTimeout(timeout)
    if (!win.isDestroyed()) win.destroy()
    await rm(directory, { recursive: true, force: true })
  }
}
