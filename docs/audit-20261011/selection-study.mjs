import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const flags = new Map(process.argv.slice(2).filter(value => value.startsWith('--')).map(value => {
  const [key, ...parts] = value.slice(2).split('=')
  return [key, parts.join('=')]
}))
const output = new URL(process.argv.slice(2).find(value => !value.startsWith('--')) || './selection-study.json', import.meta.url)
const config = {
  url: flags.get('url') || 'http://127.0.0.1:5174',
  samples: Number(flags.get('samples') || 21),
  warmup: Number(flags.get('warmup') || 8)
}
if (!Number.isInteger(config.samples) || config.samples < 15 || !Number.isInteger(config.warmup) || config.warmup < 5) {
  throw new Error('Use integer samples >= 15 and warmup >= 5')
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(config.url, { timeout: 90000 })
  await page.waitForFunction(() => !!window.muya, null, { timeout: 90000 })
  const result = await page.evaluate(async ({ samples, warmup }) => {
    const muya = window.muya
    const native = window.document.getSelection()
    const initialRangeCount = native?.rangeCount ?? null
    const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve))
    const markdown = Array.from({ length: 10000 }, (_, i) => i % 10 === 0
      ? `## Section ${i}\n\n`
      : `Paragraph ${i}: **bold** and [reference][ref].\n\n`).join('') + '[ref]: https://example.com\n'
    muya.setContent(markdown)
    const afterSetContentRangeCount = native?.rangeCount ?? null
    await nextFrame()
    await nextFrame()

    const { history, scrollPage } = muya.editor
    const first = scrollPage.firstContentInDescendant()
    const second = [...scrollPage.children.iterator()][1].firstContentInDescendant()
    const originalIgnore = history._ignoreChange
    history._ignoreChange = true
    const reads = [
      'rangeCount', 'getRangeAt', 'startContainer', 'startOffset',
      'endContainer', 'endOffset', 'direction', 'anchorNode', 'rangeEndpoints', 'emptyShortCircuit'
    ]
    const cases = ['empty', 'collapsed', 'forward', 'backward']
    const rows = []
    const correctness = []

    function setNativeSelection (kind) {
      native.removeAllRanges()
      if (kind === 'empty') return
      const anchor = kind === 'backward' ? second.domNode : first.domNode
      const focus = kind === 'collapsed' ? first.domNode : kind === 'backward' ? first.domNode : second.domNode
      native.setBaseAndExtent(anchor, 0, focus, 0)
    }

    // Older browsers need the native endpoint fallback to preserve backward
    // selections; range endpoints alone describe sorted document order.
    function rangeEndpoints (selection, forceMissingDirection = false) {
      if (selection.rangeCount === 0) return null
      const range = selection.getRangeAt(0)
      const direction = forceMissingDirection ? undefined : selection.direction
      if (typeof direction !== 'string') {
        return {
          anchorNode: selection.anchorNode,
          anchorOffset: selection.anchorOffset,
          focusNode: selection.focusNode,
          focusOffset: selection.focusOffset,
          fallback: true
        }
      }
      const backward = direction === 'backward'
      return {
        anchorNode: backward ? range.endContainer : range.startContainer,
        anchorOffset: backward ? range.endOffset : range.startOffset,
        focusNode: backward ? range.startContainer : range.endContainer,
        focusOffset: backward ? range.startOffset : range.endOffset,
        fallback: false
      }
    }

    function verifyEndpoints (candidate, kind, fallback) {
      const matches = kind === 'empty'
        ? candidate === null
        : candidate.anchorNode === native.anchorNode && candidate.anchorOffset === native.anchorOffset &&
        candidate.focusNode === native.focusNode && candidate.focusOffset === native.focusOffset
      if (!matches) throw new Error(`${kind}: range endpoints differ from native anchor/focus`)
      return { kind, fallback, matches }
    }

    try {
      for (const kind of cases) {
        const byRead = Object.fromEntries(reads.map(read => [read, []]))
        for (let i = 0; i < samples + warmup; i++) {
          for (const read of reads) {
            setNativeSelection(kind)
            await nextFrame()
            const range = native.rangeCount ? native.getRangeAt(0) : null
            first.text += 'a'
            first.update()
            const started = performance.now()
            let value
            switch (read) {
              case 'rangeCount': value = native.rangeCount; break
              case 'getRangeAt': value = native.rangeCount ? native.getRangeAt(0) : null; break
              case 'startContainer': value = range?.startContainer; break
              case 'startOffset': value = range?.startOffset; break
              case 'endContainer': value = range?.endContainer; break
              case 'endOffset': value = range?.endOffset; break
              case 'direction': value = native.direction; break
              case 'anchorNode': value = native.anchorNode; break
              case 'rangeEndpoints': value = rangeEndpoints(native); break
              case 'emptyShortCircuit': value = native.rangeCount ? native.anchorNode : null; break
            }
            const elapsed = performance.now() - started
            if (i >= warmup) byRead[read].push(elapsed)
            if (read === 'rangeEndpoints') verifyEndpoints(value, kind, false)
            muya.flush()
          }
        }
        setNativeSelection(kind)
        await nextFrame()
        first.text += 'a'
        first.update()
        const candidate = rangeEndpoints(native)
        const fallbackCandidate = rangeEndpoints(native, true)
        correctness.push({
          ...verifyEndpoints(candidate, kind, false),
          oldBrowserFallback: verifyEndpoints(fallbackCandidate, kind, true).matches,
          rangeCount: native.rangeCount,
          direction: native.direction ?? null,
          actualBackward: kind === 'backward' && native.anchorNode === second.domNode
        })
        muya.flush()
        for (const [read, values] of Object.entries(byRead)) {
          const sorted = values.toSorted((a, b) => a - b)
          rows.push({
            kind,
            read,
            medianMs: sorted[Math.floor(sorted.length / 2)],
            p90Ms: sorted[Math.floor((sorted.length - 1) * 0.9)],
            samplesMs: values
          })
        }
      }
      return {
        blocks: 10001,
        characters: markdown.length,
        initialRangeCount,
        afterSetContentRangeCount,
        directionSupported: typeof native.direction === 'string',
        rows,
        correctness
      }
    } finally {
      native.removeAllRanges()
      history._ignoreChange = originalIgnore
    }
  }, config)
  await writeFile(output, JSON.stringify({
    recordedAt: new Date().toISOString(),
    browser: browser.version(),
    config,
    errors,
    notes: [
      'Each getter is measured after its own frame and leaf update; earlier getters cannot consume the pending browser work.',
      'History recording is temporarily suppressed to keep later frame work from invoking the getter under investigation.',
      'Endpoint identity is checked against native anchor/focus only after the timed region, including simulated missing direction.'
    ],
    ...result
  }, null, 2) + '\n')
  console.log(JSON.stringify({
    output: fileURLToPath(output),
    errors,
    initialRangeCount: result.initialRangeCount,
    afterSetContentRangeCount: result.afterSetContentRangeCount,
    correctness: result.correctness,
    rows: result.rows.map(({ kind, read, medianMs }) => ({ kind, read, medianMs }))
  }, null, 2))
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
