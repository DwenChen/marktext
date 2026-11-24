import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import {
  expectNoRendererErrors,
  launchWithMarkdown,
  sendIpcToRenderer,
  waitForMenuReady
} from './helpers'

const COMPLEX_DOC = `# Complex Export Fidelity Test

> [!IMPORTANT]
> Single-tilde ranges like 180~265 ns and 395~440 ns must stay plain text, **1.39~1.47 µs** must stay bold, while ~~old text~~ remains struck through.

## 1. Wide Multi-Column Table

| Batch | Filename | Window (µs) | Duty | Edges | Pulse Width (ns) | R20 | Local R20 / NCC | NCO Offset | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| Lab | \`cap_sidata_rise.csv\` | 40.96 | 36.9% | 25 | 595 / 598 / 600 | 0.998 | \`R320 = 1.000\` | 875,667 (+4.39%) | Clean data fill |
| RX | \`LED_02_stronglight_2s.csv\` | 655.36 | 92.9% | 214 | 490 / 7253 / 60990 | 0.070 | 499~530 µs dip | 872,827 (+4.05%) | Strong saturation |
| RX | \`LD_03_cont0s.csv\` | 655.36 | 44.4% | 1051 | 165 / 630 / 2680 | 0.045 | \`NCC=0.900\` | 853,669 (+1.77%) | Sync pulse narrowing |

## 2. Math & ASCII Diagram

Inline math $T_p = 100\\text{ ns}$ and $\\tau \\approx 58\\text{ ns}$:

$$W(\\alpha) = T_p + \\tau \\ln\\!\\left(\\frac{(1 - e^{-T_p/\\tau})(1 - \\alpha)}{\\alpha}\\right)$$

\`\`\`text
TX: ppm_tx_framer ─► ppm_modulator ─► bmc_line_tx ─► IOB Reg ─► SODATA
RX: SIDATA ─► 2-FF ─► rx_input_filter ─► bmc_line_rx ─► pulse_slicer
    ┌───────┐       ┌────┐       ┌───────┐    ┌────┐
    ┘       └───────┘    └───────┘       └────┘    └───────
\`\`\`

## 3. Tall Mermaid Flowchart

\`\`\`mermaid
flowchart TD
    A["Step 1: Low duty cycle 16-PPM stream"] --> B["Step 2: AC-coupled front-end receiver"]
    B --> C1["Step 3A: Pulse tail widening 180~600ns"]
    B --> C2["Step 3B: Undershoot dead zone 12~64us"]
    B --> C3["Step 3C: Idle comparator oscillation"]
    C1 --> D1["Step 4A: Sync gap merge"]
    C2 --> D2["Step 4B: Frame header loss"]
    C3 --> D3["Step 4C: False edges"]
    D1 --> E["Step 5: State machine stuck"]
    D2 --> F["Step 6: NCO saturation"]
    D3 --> F
    E --> G["Step 7: Link unlocked"]
    F --> G
\`\`\`
`

// eslint-disable-next-line no-empty-pattern -- Electron owns the browser windows.
test('complex document exports cleanly to HTML, PDF, and PNG even from dark mode', async({}, testInfo) => {
  test.setTimeout(120000)
  const { app, page } = await launchWithMarkdown(COMPLEX_DOC, {
    suppressErrorDialog: true,
    preferences: { appearance: 'dark', language: 'en', theme: 'github' }
  })
  try {
    await waitForMenuReady(app)

    const exportTo = async(
      format: 'styledHtml' | 'pdf' | 'png',
      filename: string,
      configure?: () => Promise<void>
    ): Promise<Buffer> => {
      const target = testInfo.outputPath(filename)
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = (async() => ({
          canceled: false,
          filePath
        })) as typeof dialog.showSaveDialog
      }, target)
      await sendIpcToRenderer(app, 'mt::show-export-dialog', format)
      const popup = page.locator('.export-settings-dialog:visible')
      await popup.waitFor({ state: 'visible', timeout: 10000 })
      if (configure) await configure()
      await popup.locator('.button-primary').click()
      await expect
        .poll(() => existsSync(target) && readFileSync(target).length > 0, { timeout: 45000 })
        .toBe(true)
      return readFileSync(target)
    }

    // 1. HTML export: single-tilde ranges preserved, KaTeX & Mermaid SVG valid, no horizontal overflow.
    const htmlBuf = await exportTo('styledHtml', 'complex.html')
    const html = htmlBuf.toString('utf8')
    expect(html).toContain('180~265 ns and 395~440 ns')
    expect(html).toContain('<strong>1.39~1.47 µs</strong>')
    expect(html).toContain('<del>old text</del>')
    expect(html).toContain('katex-display')
    expect(html).toMatch(/<svg[^>]+viewBox=/)

    const htmlWindowPromise = app.waitForEvent('window')
    await app.evaluate(({ BrowserWindow }, filename) => {
      const preview = new BrowserWindow({ width: 1200, height: 900, show: false })
      void preview.loadFile(filename)
    }, testInfo.outputPath('complex.html'))
    const htmlWindow = await htmlWindowPromise
    await htmlWindow.waitForLoadState('load')
    await htmlWindow.evaluate(() => document.fonts.ready)
    const overflow = await htmlWindow.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
    expect(overflow).toBe(true)
    await htmlWindow.close()

    // 2. PDF export (standard A4 + custom page size in mm converted to inches).
    const pdfBuf = await exportTo('pdf', 'complex-a4.pdf')
    expect(pdfBuf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(pdfBuf.length).toBeGreaterThan(20_000)

    const customPdfBuf = await exportTo('pdf', 'complex-custom.pdf', async() => {
      const popup = page.locator('.export-settings-dialog:visible')
      await popup.locator('.page-size-select .el-select').click()
      await page.locator('.el-select-dropdown__item:visible').filter({ hasText: /^Custom$/ }).click()
    })
    expect(customPdfBuf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    expect(customPdfBuf.length).toBeGreaterThan(20_000)

    // 3. PNG export at 800px requested width (exact width, valid PNG signature).
    const pngBuf = await exportTo('png', 'complex-800.png', async() => {
      const input = page.locator('.export-settings-dialog:visible .image-options input')
      await input.fill('800')
      await input.press('Enter')
    })
    expect(pngBuf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(pngBuf.readUInt32BE(16)).toBe(800)
    expect(pngBuf.readUInt32BE(20)).toBeGreaterThan(800)

    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
