import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clickMenuById,
  enterSourceMode,
  expectNoRendererErrors,
  launchWithMarkdown
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
    }
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].emit('resized'))
    await expect.poll(async() => (await viewportSize(page)).width).toBeLessThan(before.width - 200)
    await expect
      .poll(async() => (await viewportSize(page)).height)
      .toBeLessThan(before.height - 100)
    await expect
      .poll(async() => (await viewportSize(page)).documentHeight)
      .toBeGreaterThan(before.documentHeight)

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
