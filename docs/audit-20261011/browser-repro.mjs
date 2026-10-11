import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:5174', { timeout: 90000 })
  await page.waitForFunction(() => !!window.muya, null, { timeout: 90000 })
  const result = await page.evaluate(async () => {
    const muya = window.muya
    const { wordCount } = await import('/@fs/C:/Users/chen/Desktop/marktext-develop/packages/muya/src/utils/index.ts')
    const { contentSignature } = await import('/@fs/C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/common/contentSignature.ts')
    const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(resolve))
    const tocEvents = []
    const collectToc = () => tocEvents.push({ markdown: muya.getMarkdown(), toc: muya.getTOC() })
    muya.setContent('# Before\n\nbody')
    muya.on('json-change', collectToc)
    muya.replaceContent('# After\n\nbody')
    const afterReplacement = muya.getTOC()
    muya.undo()
    const afterUndo = muya.getTOC()
    muya.off('json-change', collectToc)

    muya.setOptions({ texMathGfm: false }, true)
    muya.setContent('```math\nx\n```')
    let content
    muya.editor.scrollPage.breadthFirstTraverse((node) => {
      if (node.blockName === 'codeblock.content') content = node
    })
    content.text += 'y'
    content.update()
    muya.flush()
    const beforeToggle = muya.getMarkdown()
    const historyBeforeToggle = muya.getHistory()
    muya.setOptions({ texMathGfm: true }, true)
    const afterToggle = muya.getMarkdown()
    let undoError = null
    try { muya.undo() } catch (error) { undoError = error.message }
    const afterToggleUndo = muya.getMarkdown()

    muya.setOptions({ footnote: false }, true)
    muya.setContent('[^f]: note')
    const footnoteLeaf = muya.editor.scrollPage.firstContentInDescendant()
    footnoteLeaf.text += '!'
    footnoteLeaf.update()
    muya.flush()
    const beforeFootnoteToggle = muya.getState()
    muya.setOptions({ footnote: true }, true)
    const afterFootnoteToggle = muya.getState()
    let footnoteUndoError = null
    try { muya.undo() } catch (error) { footnoteUndoError = error.message }
    const footnoteUndo = { beforeFootnoteToggle, afterFootnoteToggle, footnoteUndoError, markdown: muya.getMarkdown() }

    const pendingCases = []
    for (const options of [{ superSubScript: true }, { footnote: false }]) {
      muya.setContent('alpha')
      const leaf = muya.editor.scrollPage.firstContentInDescendant()
      leaf.text = 'alpha!'
      leaf.update()
      muya.setOptions(options, true)
      await nextFrame()
      pendingCases.push({ options, markdown: muya.getMarkdown(), dom: muya.domNode.textContent })
    }

    const inputSamples = []
    for (const count of [1000, 3000, 10000]) {
      const markdown = Array.from({ length: count }, (_, i) => i % 10 === 0
        ? `## Section ${i}\n\n`
        : `Paragraph ${i}: **bold** and [reference][ref].\n\n`).join('') + '[ref]: https://example.com\n'
      muya.setContent(markdown)
      await nextFrame()
      await nextFrame()
      const tracker = { build: contentSignature }
      const measures = []
      const callback = () => {
        const started = performance.now()
        const md = muya.getMarkdown()
        const serialized = performance.now()
        wordCount(md)
        const counted = performance.now()
        tracker.build(md)
        const hashed = performance.now()
        muya.getTOC()
        const outlined = performance.now()
        measures.push({
          serialization: serialized - started,
          wordCount: counted - serialized,
          hash: hashed - counted,
          toc: outlined - hashed,
          derivedTotal: outlined - started
        })
      }
      muya.on('json-change', callback)
      const samples = []
      for (let i = 0; i < 5; i++) {
        const leaf = muya.editor.scrollPage.firstContentInDescendant()
        const start = performance.now()
        leaf.text += 'a'
        leaf.update()
        muya.flush()
        samples.push(performance.now() - start)
        await nextFrame()
      }
      muya.off('json-change', callback)
      samples.sort((a, b) => a - b)
      inputSamples.push({
        blocks: count + 1,
        characters: markdown.length,
        synchronousEditMedianMs: samples[2],
        samplesMs: samples,
        derived: measures
      })
    }
    const sourceCaretSamples = []
    const cmModule = await import('/@fs/C:/Users/chen/Desktop/marktext-develop/node_modules/codemirror/lib/codemirror.js')
    const CodeMirror = cmModule.default || window.CodeMirror
    for (const lines of [1000, 10000, 100000]) {
      const md = Array.from({ length: lines }, (_, i) => `Paragraph ${i}: example sentence with text.`).join('\n')
      const host = document.createElement('div')
      document.body.appendChild(host)
      const cm = CodeMirror(host, { value: md, viewportMargin: 10 })
      const samples = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        wordCount(cm.getValue())
        samples.push(performance.now() - start)
      }
      samples.sort((a, b) => a - b)
      sourceCaretSamples.push({ lines, characters: md.length, getValueAndCountMedianMs: samples[2], samplesMs: samples })
      host.remove()
    }
    return {
      tocEvents,
      afterReplacement,
      afterUndo,
      parseOptionUndo: { beforeToggle, afterToggle, historyBeforeToggle, undoError, afterToggleUndo },
      footnoteUndo,
      pendingCases,
      inputSamples,
      sourceCaretSamples
    }
  })
  const report = { recordedAt: new Date().toISOString(), browser: browser.version(), errors, ...result }
  await writeFile(new URL(process.argv[2] || './browser-after-fixes.json', import.meta.url), JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ errors, pendingCases: report.pendingCases, footnoteUndoError: report.footnoteUndo.footnoteUndoError, inputSamples: report.inputSamples.map(({ blocks, synchronousEditMedianMs }) => ({ blocks, synchronousEditMedianMs })) }, null, 2))
} finally {
  await browser.close()
}
