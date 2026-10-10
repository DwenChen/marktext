import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

// Run against packages/muya/e2e's Vite host so both revisions use the same browser.
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
  headless: true
})
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.goto('http://127.0.0.1:5174')
  await page.waitForFunction(() => !!window.muya)
  const result = await page.evaluate(async () => {
    const muya = window.muya
    const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve))
    const fixtures = [1000, 3000, 10000].map((count) => ({
      count,
      markdown:
        Array.from({ length: count }, (_, i) =>
          i % 10 === 0
            ? `## Section ${i}\n\n`
            : `Paragraph ${i}: **bold** and [reference][ref].\n\n`
        ).join('') + '[ref]: https://example.com\n'
    }))
    const loads = []
    for (const { count, markdown } of fixtures) {
      const samples = []
      for (let i = 0; i < 3; i++) {
        muya.setContent('warmup')
        const start = performance.now()
        muya.setContent(markdown)
        muya.getTOC()
        await nextFrame()
        await nextFrame()
        samples.push(performance.now() - start)
      }
      samples.sort((a, b) => a - b)
      loads.push({
        blocks: count + 1,
        characters: markdown.length,
        medianMs: Math.round(samples[1]),
        samplesMs: samples.map(Math.round)
      })
    }
    muya.setContent('empty')
    const listenersBefore = muya.eventCenter.events.length
    const markdown = fixtures[0].markdown
    for (let i = 0; i < 10; i++) {
      muya.setContent(markdown)
      muya.setContent('empty')
    }
    await nextFrame()
    return { loads, listenersBefore, listenersAfter: muya.eventCenter.events.length }
  })
  const report = { recordedAt: new Date().toISOString(), ...result }
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
