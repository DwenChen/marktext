import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const output = new URL(process.argv[2] || './selection-layout-trace.json', import.meta.url)
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto(process.argv[3] || 'http://127.0.0.1:5174', { timeout: 90000 })
  await page.waitForFunction(() => !!window.muya, null, { timeout: 90000 })
  await page.evaluate(async () => {
    const muya = window.muya
    const markdown = Array.from({ length: 10000 }, (_, i) => i % 10 === 0
      ? `## Section ${i}\n\n`
      : `Paragraph ${i}: **bold** and [reference][ref].\n\n`).join('') + '[ref]: https://example.com\n'
    muya.setContent(markdown)
    window.document.getSelection().removeAllRanges()
    await new Promise(resolve => window.requestAnimationFrame(resolve))
    await new Promise(resolve => window.requestAnimationFrame(resolve))
  })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing',
    transferMode: 'ReturnAsStream'
  })
  const samples = await page.evaluate(async () => {
    const muya = window.muya
    const native = window.document.getSelection()
    const history = muya.editor.history
    const ignore = history._ignoreChange
    history._ignoreChange = true
    const samples = []
    try {
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => window.requestAnimationFrame(resolve))
        const leaf = muya.editor.scrollPage.firstContentInDescendant()
        leaf.text += 'a'
        leaf.update()
        window.performance.mark(`selection-read-start-${i}`)
        const start = performance.now()
        const anchor = native.anchorNode
        const elapsed = performance.now() - start
        window.performance.mark(`selection-read-end-${i}`)
        samples.push({ elapsedMs: elapsed, anchorIsNull: anchor === null })
        muya.flush()
      }
      return samples
    } finally {
      history._ignoreChange = ignore
    }
  })
  const streamReady = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve))
  await cdp.send('Tracing.end')
  const { stream } = await streamReady
  const chunks = []
  while (true) {
    const { data, eof } = await cdp.send('IO.read', { handle: stream })
    chunks.push(data)
    if (eof) break
  }
  await cdp.send('IO.close', { handle: stream })
  const trace = JSON.parse(chunks.join(''))
  const intervals = samples.map((sample, i) => {
    const started = trace.traceEvents.find(event => event.name === `selection-read-start-${i}`)
    const ended = trace.traceEvents.find(event => event.name === `selection-read-end-${i}`)
    const nested = trace.traceEvents.filter(event => event.pid === started.pid && event.tid === started.tid &&
      event.ts >= started.ts && event.ts < ended.ts && ['Layout', 'UpdateLayoutTree', 'RecalculateStyles', 'PrePaint'].includes(event.name))
    return { ...sample, browserWork: nested.map(({ name, dur, args }) => ({ name, durationMs: (dur || 0) / 1000, args })) }
  })
  await writeFile(output, JSON.stringify({ recordedAt: new Date().toISOString(), browser: browser.version(), intervals, ...trace }) + '\n')
  console.log(JSON.stringify({ output: fileURLToPath(output), intervals }, null, 2))
  await cdp.detach()
} finally {
  await browser.close()
}
