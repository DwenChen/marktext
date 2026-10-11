import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  clickMenuById,
  enterSourceMode,
  expectNoRendererErrors,
  launchWithMarkdown,
  launchElectron,
  sendIpcToRenderer,
  waitForEditor
} from './helpers'

const viewportSize = (page: Page) =>
  page.locator('.editor-with-tabs > .container').evaluate((el) => {
    const rect = el.getBoundingClientRect()
    const editor = el.querySelector('.editor-component')!
    const style = getComputedStyle(editor)
    return {
      width: rect.width,
      height: rect.height,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
      documentHeight: el.querySelector('.mu-container')!.getBoundingClientRect().height
    }
  })

const availableSize = (page: Page) =>
  page.locator('.editor-with-tabs').evaluate((el) => {
    const content = el.querySelector<HTMLElement>('.container')!
    return { width: el.clientWidth, height: el.clientHeight - content.offsetTop }
  })

const tabBarFits = (page: Page) =>
  page.evaluate(() => {
    const host = document.querySelector('.editor-with-tabs')!.getBoundingClientRect()
    const bar = document.querySelector('.editor-tabs')!.getBoundingClientRect()
    const strip = document.querySelector('.scrollable-tabs')!.getBoundingClientRect()
    const active = document.querySelector('.tabs-container > li.active')!.getBoundingClientRect()
    const add = document.querySelector('.editor-tabs .new-file')!.getBoundingClientRect()
    const close = document.querySelector('.tabs-container > li.active .close-icon')!
    const closeRect = close.getBoundingClientRect()
    const hit = document.elementFromPoint(closeRect.left + closeRect.width / 2, closeRect.top + closeRect.height / 2)
    return bar.height === 28 && bar.top === host.top && bar.bottom <= host.bottom &&
      bar.left >= host.left && bar.right <= host.right + 1 &&
      active.height === 28 && active.left >= strip.left - 1 && active.right <= strip.right + 1 &&
      add.left >= strip.right - 1 && add.right <= bar.right + 1 &&
      (hit === close || close.contains(hit))
  })

const resizeWindow = (app: ElectronApplication, width: number, height: number, edge: string) =>
  app.evaluate(
    ({ BrowserWindow }, bounds) => {
      const win = BrowserWindow.getAllWindows()[0]
      // Programmatic sizing does not emit native drag boundaries. Exercise those
      // separately so headless CI covers the same main/renderer lifecycle.
      win.emit(
        'will-resize',
        {} as Electron.Event,
        { ...win.getBounds(), ...bounds },
        { edge: bounds.edge }
      )
      win.setContentSize(bounds.width, bounds.height)
    },
    { width, height, edge }
  )

test('native corner and edge drags keep document layout stable until release', async() => {
  const markdown = Array.from(
    { length: 40 },
    (_, i) =>
      `Paragraph ${i}: ${'**wrapped text** and a [link](https://example.com) '.repeat(6)}\n\n`
  ).join('')
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { tabBarVisibility: true, sideBarVisibility: false }
  })
  try {
    await expect(page.locator('.mu-container > *')).toHaveCount(40)
    await clickMenuById(app, 'typewriterModeMenuItem')
    await expect(page.locator('.editor-wrapper')).toHaveClass(/typewriter/)
    await expect
      .poll(() => page.locator('.editor-with-tabs > .container').evaluate((el) => el.style.height))
      .not.toBe('')
    const before = await viewportSize(page)
    const edges = [
      'left',
      'right',
      'top',
      'bottom',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right'
    ]
    for (const [index, edge] of edges.entries()) {
      await resizeWindow(app, 1100 - index * 55, 780 - index * 25, edge)
      await expect
        .poll(() => page.evaluate((target) => Math.abs(innerWidth - target), 1100 - index * 55))
        .toBeLessThan(10)
      expect(await viewportSize(page)).toEqual(before)
      // The document remains frozen, but the controls must fit the live window.
      await expect.poll(() => tabBarFits(page)).toBe(true)
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('resized'))
    await expect.poll(async() => (await viewportSize(page)).width).toBeLessThan(before.width - 200)
    await expect
      .poll(async() => (await viewportSize(page)).height)
      .toBeLessThan(before.height - 100)
    await expect
      .poll(async() => (await viewportSize(page)).documentHeight)
      .toBeGreaterThan(before.documentHeight)
    await expect.poll(() => tabBarFits(page)).toBe(true)

    // A cancelled native drag must not leave the editor pinned at its old size.
    await resizeWindow(app, 950, 720, 'bottom-right')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('blur'))
    await expect
      .poll(async() =>
        Math.abs((await viewportSize(page)).width - (await availableSize(page)).width)
      )
      .toBeLessThan(1)
    const heightWithTabs = (await viewportSize(page)).height
    await clickMenuById(app, 'tabBarMenuItem')
    await expect(page.locator('.editor-tabs')).toBeHidden()
    await expect
      .poll(async() => (await viewportSize(page)).height)
      .toBeGreaterThan(heightWithTabs + 20)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('active tabs remain fully visible through narrow layouts, sidebar drags and maximize cycles', async() => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'marktext-tab-resize-'))
  const files = Array.from({ length: 5 }, (_, index) => {
    const filename = `窗口缩放_长文档名称_${index}_`.repeat(3) + '.md'
    const file = path.join(directory, filename)
    writeFileSync(file, `# Document ${index}\n\nSmall document.\n`)
    return file
  })
  const { app, page } = await launchElectron(files, {
    suppressErrorDialog: true,
    preferences: { tabBarVisibility: true, sideBarVisibility: true }
  })
  try {
    await waitForEditor(page)
    await expect(page.locator('.tabs-container > li')).toHaveCount(5)
    await sendIpcToRenderer(app, 'mt::switch-tab-by-index', 4)
    await expect(page.locator('.mu-container h1')).toContainText('Document 4')
    const activeId = await page.locator('.tabs-container > li.active').getAttribute('data-id')

    for (const [width, height] of [[1200, 800], [720, 500], [550, 350], [1250, 750]]) {
      await app.evaluate(({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height)
      }, { width, height })
      await expect.poll(() => tabBarFits(page)).toBe(true)
      expect(await page.locator('.tabs-container > li.active').getAttribute('data-id')).toBe(activeId)
    }
    // A long tab expands again after the narrow window (no stale width cap).
    await expect.poll(() => page.locator('.tabs-container > li.active').evaluate(el => el.getBoundingClientRect().width)).toBe(280)

    const handle = await page.locator('.side-bar .drag-bar').boundingBox()
    expect(handle).not.toBeNull()
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 90)
    await page.mouse.down()
    await page.mouse.move(900, handle!.y + 90, { steps: 15 })
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await page.mouse.up()
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator('.side-bar')).toBeHidden()
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await clickMenuById(app, 'sideBarMenuItem')
    await expect(page.locator('.side-bar')).toBeVisible()
    await expect.poll(() => tabBarFits(page)).toBe(true)

    await enterSourceMode(page, app)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1100, 450))
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await clickMenuById(app, 'tabBarMenuItem')
    await expect(page.locator('.editor-tabs')).toBeHidden()
    await clickMenuById(app, 'tabBarMenuItem')
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize())
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize())
    await expect.poll(() => tabBarFits(page)).toBe(true)
    await expect(page.locator('.mu-container h1')).toContainText('Document 4')
    await page.screenshot({ path: 'test-results/tabs-resize-narrow.png' })
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('rapid viewport changes are coalesced when native IPC is delayed or unavailable', async() => {
  const markdown = Array.from({ length: 1000 }, (_, i) => `Paragraph ${i} with **bold** text.\n\n`).join('')
  const { app, page } = await launchWithMarkdown(markdown, { suppressErrorDialog: true })
  try {
    await expect(page.locator('.mu-container > *')).toHaveCount(1000)
    const before = await viewportSize(page)
    await page.evaluate(() => {
      const sizes: number[] = []
      let previousWidth: number | undefined
      ;(window as unknown as { documentResizeWidths: number[] }).documentResizeWidths = sizes
      new ResizeObserver(entries => {
        const width = entries[0].contentRect.width
        if (width !== previousWidth) sizes.push(width)
        previousWidth = width
      }).observe(document.querySelector('.mu-container')!)
    })
    await expect.poll(() => page.evaluate(() => (window as unknown as { documentResizeWidths: number[] }).documentResizeWidths.length)).toBe(1)
    await page.evaluate(() => { (window as unknown as { documentResizeWidths: number[] }).documentResizeWidths.length = 0 })
    await app.evaluate(async({ BrowserWindow }) => {
      for (const width of [1100, 1000, 900, 800, 750, 700]) {
        BrowserWindow.getAllWindows()[0].setContentSize(width, 600)
        await new Promise(resolve => setTimeout(resolve, 30))
      }
    })
    await expect.poll(async() => (await viewportSize(page)).width).toBeLessThan(before.width - 300)
    await expect.poll(async() => Math.abs((await viewportSize(page)).width - (await availableSize(page)).width)).toBeLessThan(1)
    expect(await page.evaluate(() => (window as unknown as { documentResizeWidths: number[] }).documentResizeWidths.length)).toBe(1)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('math query containment is enabled only when a formula needs the text column width', async() => {
  const { app, page } = await launchWithMarkdown('Plain text.\n\n', {
    suppressErrorDialog: true,
    preferences: { texMathDollars: true }
  })
  try {
    const containerType = () => page.locator('.mu-container').evaluate(el => getComputedStyle(el).containerType)
    await expect.poll(containerType).toBe('normal')
    await page.evaluate(() => {
      const root = document.querySelector('.mu-container') as HTMLElement & {
        __MUYA_BLOCK__: { muya: { replaceContent: (markdown: string) => void } }
      }
      root.__MUYA_BLOCK__.muya.replaceContent('Plain text.\n\n$a+b$\n')
    })
    await expect(page.locator('.mu-math-render')).toBeVisible()
    await expect.poll(containerType).toBe('inline-size')
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(700, 600))
    await expect.poll(async() => (await viewportSize(page)).width).toBeLessThan(700)
    await expect(page.locator('.mu-math-render')).toBeVisible()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('source editor follows the final viewport without changing text or scroll during a drag', async() => {
  const markdown = Array.from(
    { length: 120 },
    (_, i) => `Line ${i}: ${'long text '.repeat(15)}\n\n`
  ).join('')
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { sideBarVisibility: false }
  })
  try {
    await enterSourceMode(page, app)
    await page.locator('.source-code').evaluate((el) => {
      el.scrollTop = 400
    })
    const readSource = () =>
      page.locator('.source-code').evaluate((el) => ({
        width: el.getBoundingClientRect().width,
        height: el.clientHeight,
        scrollTop: el.scrollTop,
        text: el.querySelector('.CodeMirror-code')!.textContent
      }))
    const before = await readSource()
    await resizeWindow(app, 740, 580, 'bottom-right')
    await expect.poll(() => page.evaluate(() => Math.abs(innerWidth - 740))).toBeLessThan(10)
    expect(await readSource()).toEqual(before)
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('resized'))
    await expect
      .poll(async() => Math.abs((await readSource()).width - (await availableSize(page)).width))
      .toBeLessThan(1)
    await expect.poll(async() => (await readSource()).height).toBeLessThan(before.height - 100)
    expect((await readSource()).text).toBe(before.text)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
