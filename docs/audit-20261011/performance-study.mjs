import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const flags = new Map(process.argv.slice(2).filter(value => value.startsWith('--')).map(value => {
  const [key, ...parts] = value.slice(2).split('=')
  return [key, parts.join('=') || true]
}))
const outputName = process.argv.slice(2).find(value => !value.startsWith('--')) || './performance-study.json'
const output = new URL(outputName, import.meta.url)
const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '')
const config = {
  root,
  counts: String(flags.get('counts') || '1000,3000,10000').split(',').map(Number),
  samples: Number(flags.get('samples') || 21),
  warmup: Number(flags.get('warmup') || 8),
  selectionMode: String(flags.get('selection') || 'empty'),
  measurementMode: String(flags.get('mode') || 'all'),
  url: String(flags.get('url') || 'http://127.0.0.1:5174')
}
if (!['empty', 'caret'].includes(config.selectionMode)) {
  throw new Error('Use --selection=empty or --selection=caret')
}
if (!['all', 'plain', 'instrumented'].includes(config.measurementMode)) {
  throw new Error('Use --mode=all, --mode=plain or --mode=instrumented')
}
if (config.counts.some(count => !Number.isInteger(count) || count < 20) ||
    !Number.isInteger(config.samples) || config.samples < 15 ||
    !Number.isInteger(config.warmup) || config.warmup < 5) {
  throw new Error('Use integer counts >= 20, samples >= 15, and warmup >= 5')
}

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const errors = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(config.url, { timeout: 90000 })
  await page.waitForFunction(() => !!window.muya, null, { timeout: 90000 })
  const result = flags.get('profile-only')
    ? { reports: [] }
    : await page.evaluate(async ({ root, counts, samples, warmup, selectionMode, measurementMode }) => {
      const muya = window.muya
      const { wordCount, deepClone } = await import(`/@fs/${root}/packages/muya/src/utils/index.ts`)
      const { contentSignature } = await import(`/@fs/${root}/packages/desktop/src/common/contentSignature.ts`)
      const { editor } = muya
      const { jsonState, history, inlineRenderer } = editor
      const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve))
      const nativeSelection = window.document.getSelection()
      async function prepareSelection (leaf) {
        if (selectionMode === 'caret') {
          const dom = leaf.domNode
          const offset = dom.childNodes.length
          nativeSelection.setBaseAndExtent(dom, offset, dom, offset)
        } else {
          nativeSelection.removeAllRanges()
        }
        await nextFrame()
        const expectedCount = selectionMode === 'caret' ? 1 : 0
        if (nativeSelection.rangeCount !== expectedCount) throw new Error('Unexpected native selection before measurement')
      }
      const restores = []
      let activeSample = null
      let instrumented = false
      const stack = []

      // Exclusive times partition nested calls; inclusive times show their scope.
      // Only the separate plain mode is comparable to the original 34 ms probe.
      function timed (name, work) {
        if (!instrumented || !activeSample) return work()
        const span = { name, child: 0, started: performance.now() }
        stack.push(span)
        try {
          return work()
        } finally {
          const inclusive = performance.now() - span.started
          stack.pop()
          const parent = stack.at(-1)
          if (parent) parent.child += inclusive
          const phase = activeSample.phases[name] ||= { calls: 0, inclusiveMs: 0, exclusiveMs: 0 }
          phase.calls++
          phase.inclusiveMs += inclusive
          phase.exclusiveMs += Math.max(0, inclusive - span.child)
        }
      }

      function wrap (target, method, name) {
        const original = target[method]
        if (typeof original !== 'function') return
        const descriptor = Object.getOwnPropertyDescriptor(target, method)
        target[method] = function (...args) {
          return timed(typeof name === 'function' ? name(args) : name, () => original.apply(this, args))
        }
        restores.push(() => descriptor ? Object.defineProperty(target, method, descriptor) : delete target[method])
      }

      function wrapGetter (target, property, name) {
        const descriptor = Object.getOwnPropertyDescriptor(target, property)
        if (!descriptor?.get || !descriptor.configurable) return
        Object.defineProperty(target, property, {
          ...descriptor,
          get () {
            return timed(name, () => descriptor.get.call(this))
          }
        })
        restores.push(() => Object.defineProperty(target, property, descriptor))
      }

      wrap(jsonState, 'getState', () => {
        if (stack.some(span => span.name === 'history.replay')) return 'snapshot.undoRollback'
        if (stack.some(span => span.name === 'state.flushCache' || span.name === 'state.dispatch')) return 'snapshot.prevDoc'
        return 'snapshot.public'
      })
      wrap(jsonState, '_apply', 'state.apply')
      wrap(jsonState, 'dispatch', 'state.dispatch')
      wrap(jsonState, '_flushOperationCache', 'state.flushCache')
      wrap(jsonState, 'flush', 'state.flush')
      wrap(jsonState, 'getMarkdown', 'serialization.cacheLookup')
      wrap(jsonState, 'getMarkdownFromState', 'serialization.full')
      wrap(history, '_record', 'history.recordIncludingInvert')
      wrap(history, '_getLastSelection', 'history.selectionStack')
      wrap(history, '_change', 'history.replay')
      wrap(editor.selection, 'getSelection', 'selection.getSelection')
      wrap(editor.selection._text, 'getSelection', 'selection.textGetSelection')
      wrap(window.document, 'getSelection', 'selection.nativeGetSelection')
      for (const property of ['anchorNode', 'anchorOffset', 'focusNode', 'focusOffset']) {
        wrapGetter(window.Selection.prototype, property, `selection.native.${property}`)
      }
      wrap(editor.scrollPage.children.constructor.prototype, 'offset', 'tree.offset')
      wrap(editor.scrollPage.children.constructor.prototype, 'iterator', 'tree.iteratorCreation')
      wrap(inlineRenderer, 'collectReferenceDefinitions', 'references.collect')

      let latestDerived = null
      const derive = () => {
        const started = performance.now()
        const markdown = timed('derived.serialization', () => muya.getMarkdown())
        const serialized = performance.now()
        const statistics = timed('derived.wordCount', () => wordCount(markdown))
        const counted = performance.now()
        const signature = timed('derived.signature', () => contentSignature(markdown))
        const hashed = performance.now()
        const toc = timed('derived.toc', () => muya.getTOC())
        const outlined = performance.now()
        latestDerived = { markdown, statistics, signature, toc }
        if (activeSample) {
          activeSample.jsonChangeEvents++
          activeSample.derived.push({
            serializationMs: serialized - started,
            wordCountMs: counted - serialized,
            signatureMs: hashed - counted,
            tocMs: outlined - hashed,
            totalMs: outlined - started
          })
        }
      }

      const quantile = (values, fraction) => {
        const ordered = values.toSorted((a, b) => a - b)
        const offset = (ordered.length - 1) * fraction
        const lower = Math.floor(offset)
        return ordered[lower] + (ordered[Math.ceil(offset)] - ordered[lower]) * (offset - lower)
      }
      const summary = values => ({
        medianMs: quantile(values, 0.5),
        p90Ms: quantile(values, 0.9),
        minMs: Math.min(...values),
        maxMs: Math.max(...values)
      })
      const summarizeRows = rows => {
        const phaseNames = [...new Set(rows.flatMap(row => Object.keys(row.phases)))]
        return {
          ...summary(rows.map(row => row.synchronousMs)),
          phaseExclusiveMediansMs: Object.fromEntries(phaseNames.map(name => [name,
            quantile(rows.map(row => row.phases[name]?.exclusiveMs || 0), 0.5)])),
          phaseInclusiveMediansMs: Object.fromEntries(phaseNames.map(name => [name,
            quantile(rows.map(row => row.phases[name]?.inclusiveMs || 0), 0.5)])),
          samples: rows
        }
      }

      function assertCurrent (label) {
        const markdown = muya.getMarkdown()
        const reference = jsonState.getMarkdownFromState(jsonState.getReadonlyState())
        if (markdown !== reference) throw new Error(`${label}: cached serialization differs from full serialization`)
        if (latestDerived?.markdown !== markdown) throw new Error(`${label}: json-change observed stale markdown`)
        if (latestDerived.signature !== contentSignature(reference)) throw new Error(`${label}: signature differs`)
        if (JSON.stringify(latestDerived.statistics) !== JSON.stringify(wordCount(reference))) throw new Error(`${label}: count differs`)
        if (JSON.stringify(latestDerived.toc) !== JSON.stringify(muya.getTOC())) throw new Error(`${label}: outline differs`)
      }

      function capture (work) {
        const row = {
          synchronousMs: 0,
          jsonChangeEvents: 0,
          derived: [],
          phases: {},
          rangeCountBeforeChange: nativeSelection.rangeCount
        }
        activeSample = row
        const started = performance.now()
        try {
          work()
          row.synchronousMs = performance.now() - started
        } finally {
          activeSample = null
        }
        if (row.jsonChangeEvents !== 1) throw new Error(`Expected one json-change event, received ${row.jsonChangeEvents}`)
        assertCurrent('after operation')
        return row
      }

      const reports = []
      muya.on('json-change', derive)
      try {
        for (const count of counts) {
          const markdown = Array.from({ length: count }, (_, i) => i % 10 === 0
            ? `## Section ${i}\n\n`
            : `Paragraph ${i}: **bold** and [reference][ref].\n\n`).join('') + '[ref]: https://example.com\n'
          const sizes = { blocks: count + 1, characters: markdown.length, selectionMode }
          const targetSpecs = [
            { name: 'legacy-first-leaf', kind: 'legacy', position: 'first' },
            ...['paragraph', 'heading'].flatMap(kind => ['first', 'middle', 'last'].map(position => ({
              name: `${kind}-${position}`, kind, position
            })))
          ]
          const modes = measurementMode === 'all' ? ['plain', 'instrumented'] : [measurementMode]
          for (const mode of modes) {
            instrumented = mode === 'instrumented'
            for (const spec of targetSpecs) {
              muya.setContent(markdown)
              await nextFrame()
              await nextFrame()
              const blocks = [...editor.scrollPage.children.iterator()]
              const candidates = blocks.filter(block => spec.kind === 'heading'
                ? block.blockName === 'atx-heading'
                : spec.kind === 'paragraph' ? block.blockName === 'paragraph' && !block.firstContentInDescendant().text.startsWith('[ref]:') : true)
              const index = spec.position === 'last'
                ? candidates.length - 1
                : spec.position === 'middle' ? Math.floor(candidates.length / 2) : 0
              const leaf = spec.kind === 'legacy'
                ? editor.scrollPage.firstContentInDescendant()
                : candidates[index].firstContentInDescendant()
              const rows = []
              for (let i = 0; i < samples + warmup; i++) {
                await prepareSelection(leaf)
                const row = capture(() => {
                  timed('edit.leafUpdate', () => {
                    leaf.text += 'a'
                    leaf.update()
                  })
                  muya.flush()
                })
                if (i >= warmup) rows.push(row)
                await nextFrame()
              }
              reports.push({ ...sizes, mode, scenario: spec.name, ...summarizeRows(rows) })
            }

            muya.setContent(markdown)
            await nextFrame()
            await nextFrame()
            const baseline = muya.getMarkdown()
            const referenceBlock = [...editor.scrollPage.children.iterator()][Math.floor(count / 2)]
            const selectionLeaf = referenceBlock.firstContentInDescendant()
            const actionRows = { 'structural-insert': [], 'structural-undo': [], 'structural-redo': [] }
            for (let i = 0; i < samples + warmup; i++) {
              history.cutoff()
              await prepareSelection(selectionLeaf)
              const inserted = capture(() => {
                timed('edit.structuralInsert', () => {
                  const block = editor.scrollPage.constructor.loadBlock('paragraph').create(muya, {
                    name: 'paragraph', text: `Inserted sample ${i}: 中 English **text**.`
                  })
                  editor.scrollPage.insertBefore(block, referenceBlock)
                })
                muya.flush()
              })
              const expectedInserted = muya.getMarkdown()
              await prepareSelection(selectionLeaf)
              const undone = capture(() => muya.undo())
              if (muya.getMarkdown() !== baseline) throw new Error('Structural undo did not restore the document')
              await prepareSelection(selectionLeaf)
              const redone = capture(() => muya.redo())
              if (muya.getMarkdown() !== expectedInserted) throw new Error('Structural redo did not restore the insertion')
              if (i >= warmup) {
                actionRows['structural-insert'].push(inserted)
                actionRows['structural-undo'].push(undone)
                actionRows['structural-redo'].push(redone)
              }
              muya.undo()
              await nextFrame()
            }
            for (const [scenario, rows] of Object.entries(actionRows)) {
              reports.push({ ...sizes, mode, scenario, ...summarizeRows(rows) })
            }
          }

          if (measurementMode !== 'plain') {
            instrumented = false
            const cloneRows = []
            const state = jsonState.getReadonlyState()
            for (let i = 0; i < samples + warmup; i++) {
              const started = performance.now()
              const copy = deepClone(state)
              const elapsed = performance.now() - started
              if (copy === state || copy[0] === state[0]) throw new Error('Clone must isolate document objects')
              if (i >= warmup) cloneRows.push(elapsed)
              await nextFrame()
            }
            reports.push({ ...sizes, mode: 'isolated', scenario: 'deepClone-document', ...summary(cloneRows), samplesMs: cloneRows })
          }
        }
        return { reports, correctness: { cachedSerialization: true, derivedEvent: true, structuralUndoRedo: true } }
      } finally {
        muya.off('json-change', derive)
        for (const restore of restores.reverse()) restore()
      }
    }, config)

  let cpuProfileFile
  let profileSamples
  if (flags.get('cpu-profile') || flags.get('profile-only')) {
    await page.evaluate(async ({ root, warmup, selectionMode }) => {
      const { wordCount } = await import(`/@fs/${root}/packages/muya/src/utils/index.ts`)
      const { contentSignature } = await import(`/@fs/${root}/packages/desktop/src/common/contentSignature.ts`)
      const muya = window.muya
      const markdown = Array.from({ length: 10000 }, (_, i) => i % 10 === 0
        ? `## Section ${i}\n\n`
        : `Paragraph ${i}: **bold** and [reference][ref].\n\n`).join('') + '[ref]: https://example.com\n'
      muya.setContent(markdown)
      const nextFrame = () => new Promise(resolve => window.requestAnimationFrame(resolve))
      await nextFrame()
      await nextFrame()
      const leaf = muya.editor.scrollPage.firstContentInDescendant()
      const nativeSelection = window.document.getSelection()
      const derive = () => {
        const content = muya.getMarkdown()
        wordCount(content)
        contentSignature(content)
        muya.getTOC()
      }
      muya.on('json-change', derive)
      try {
        for (let i = 0; i < warmup; i++) {
          if (selectionMode === 'caret') {
            const dom = leaf.domNode
            const offset = dom.childNodes.length
            nativeSelection.setBaseAndExtent(dom, offset, dom, offset)
          } else {
            nativeSelection.removeAllRanges()
          }
          await nextFrame()
          leaf.text += 'a'
          leaf.update()
          muya.flush()
          await nextFrame()
        }
      } finally {
        muya.off('json-change', derive)
      }
    }, config)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Profiler.enable')
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 })
    await cdp.send('Profiler.start')
    profileSamples = await page.evaluate(async ({ root, selectionMode }) => {
      const { wordCount } = await import(`/@fs/${root}/packages/muya/src/utils/index.ts`)
      const { contentSignature } = await import(`/@fs/${root}/packages/desktop/src/common/contentSignature.ts`)
      const muya = window.muya
      const nativeSelection = window.document.getSelection()
      const stack = []
      const restores = []
      let active = null
      const timed = (name, work) => {
        if (!active) return work()
        const span = { child: 0, start: performance.now() }
        stack.push(span)
        try {
          return work()
        } finally {
          const elapsed = performance.now() - span.start
          stack.pop()
          if (stack.length) stack.at(-1).child += elapsed
          const phase = active.phases[name] ||= { calls: 0, inclusiveMs: 0, exclusiveMs: 0 }
          phase.calls++
          phase.inclusiveMs += elapsed
          phase.exclusiveMs += Math.max(0, elapsed - span.child)
        }
      }
      const wrap = (target, method, name) => {
        const original = target[method]
        const descriptor = Object.getOwnPropertyDescriptor(target, method)
        target[method] = function (...args) {
          return timed(name, () => original.apply(this, args))
        }
        restores.push(() => descriptor ? Object.defineProperty(target, method, descriptor) : delete target[method])
      }
      const wrapGetter = (target, property, name) => {
        const descriptor = Object.getOwnPropertyDescriptor(target, property)
        if (!descriptor?.get || !descriptor.configurable) return
        Object.defineProperty(target, property, {
          ...descriptor,
          get () {
            return timed(name, () => descriptor.get.call(this))
          }
        })
        restores.push(() => Object.defineProperty(target, property, descriptor))
      }
      const { history, selection } = muya.editor
      wrap(history, '_record', 'history.recordIncludingInvert')
      wrap(history, '_getLastSelection', 'history.selectionStack')
      wrap(selection, 'getSelection', 'selection.getSelection')
      wrap(selection._text, 'getSelection', 'selection.textGetSelection')
      wrap(window.document, 'getSelection', 'selection.nativeGetSelection')
      for (const property of ['anchorNode', 'anchorOffset', 'focusNode', 'focusOffset']) {
        wrapGetter(window.Selection.prototype, property, `selection.native.${property}`)
      }
      wrap(muya.editor.scrollPage.children.constructor.prototype, 'offset', 'tree.offset')
      wrap(muya.editor.scrollPage.children.constructor.prototype, 'iterator', 'tree.iteratorCreation')
      const rows = []
      const derive = () => {
        const markdown = timed('derived.serialization', () => muya.getMarkdown())
        timed('derived.wordCount', () => wordCount(markdown))
        timed('derived.signature', () => contentSignature(markdown))
        timed('derived.toc', () => muya.getTOC())
      }
      muya.on('json-change', derive)
      try {
        for (let i = 0; i < 50; i++) {
          const leaf = muya.editor.scrollPage.firstContentInDescendant()
          if (selectionMode === 'caret') {
            const dom = leaf.domNode
            const offset = dom.childNodes.length
            nativeSelection.setBaseAndExtent(dom, offset, dom, offset)
          } else {
            nativeSelection.removeAllRanges()
          }
          await new Promise(resolve => window.requestAnimationFrame(resolve))
          active = { phases: {}, synchronousMs: 0, rangeCountBeforeChange: nativeSelection.rangeCount }
          const start = performance.now()
          timed('edit.leafUpdate', () => {
            leaf.text += 'a'
            leaf.update()
          })
          timed('state.flush', () => muya.flush())
          active.synchronousMs = performance.now() - start
          rows.push(active)
          active = null
          await new Promise(resolve => window.requestAnimationFrame(resolve))
        }
      } finally {
        muya.off('json-change', derive)
        for (const restore of restores.reverse()) restore()
      }
      return rows
    }, config)
    const { profile } = await cdp.send('Profiler.stop')
    const profileOutput = new URL(output.href.replace(/\.json$/, '') + '.cpuprofile')
    await writeFile(profileOutput, JSON.stringify(profile) + '\n')
    cpuProfileFile = fileURLToPath(profileOutput)
    await cdp.detach()
  }

  const report = {
    recordedAt: new Date().toISOString(),
    browser: browser.version(),
    config,
    notes: [
      'plain legacy-first-leaf uses the original document, edit and synchronous derived callback; warmup and sample count are increased.',
      'instrumented timings add wrappers. Exclusive phases are disjoint; inclusive phases and stage medians must not be added together.',
      'history.recordIncludingInvert includes invertWithDoc and history coalescing; optional CPU profiling distinguishes their internal costs.',
      'Initialization, frame waits, full-state correctness checks and standalone clone samples are excluded from synchronous edit timings.',
      'The caret variant places a collapsed native selection within the edited leaf before the timed region; empty remains the original probe default.'
    ],
    errors,
    cpuProfileFile,
    profileSamples,
    profileMetadata: profileSamples ? { blocks: 10001, characters: 447917, samples: 50, selectionMode: config.selectionMode } : undefined,
    ...result
  }
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({
    output: fileURLToPath(output),
    errors,
    reports: report.reports.map(({ blocks, mode, scenario, medianMs, p90Ms }) => ({ blocks, mode, scenario, medianMs, p90Ms }))
  }, null, 2))
  if (errors.length) process.exitCode = 1
} finally {
  await browser.close()
}
