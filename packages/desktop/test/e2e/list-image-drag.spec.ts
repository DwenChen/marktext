import fs from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { expectNoRendererErrors, getMarkdownContent, launchWithMarkdown } from './helpers'

const preferences = { language: 'en', spellcheckerEnabled: false, autoSave: false }
const content = (page: Page, text: string) => page.locator('.mu-paragraph-content').filter({ hasText: text }).first()

async function menuAction(app: ElectronApplication, label: string, menu = 'Edit') {
  await app.evaluate(({ Menu, BrowserWindow }, { label, menu }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const item = Menu.getApplicationMenu()?.items.find(item => item.label === menu)?.submenu?.items.find(item => item.label === label)
    if (!item) throw new Error(`Missing menu action: ${label}`)
    item.click(undefined, win, win.webContents)
  }, { label, menu })
}

async function selectLine(page: Page, text: string, start = 0, end = text.length) {
  const line = content(page, text)
  await line.click()
  await line.evaluate((element, { text, start, end }) => {
    const range = document.createRange()
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node && node.textContent !== text) node = walker.nextNode()
    if (!node) throw new Error(`Missing text node: ${text}`)
    range.setStart(node, start)
    range.setEnd(node, end)
    const selection = document.getSelection()
    if (!selection) throw new Error('Missing selection')
    selection.removeAllRanges()
    selection.addRange(range)
  }, { text, start, end })
  return line
}

async function holdFrontHandle(page: Page, text: string) {
  const source = content(page, text)
  await source.hover()
  const handle = page.locator('.mu-front-button-wrapper')
  await expect.poll(() => handle.evaluate(element => Number.parseFloat((element as HTMLElement).style.opacity))).toBe(1)
  const box = await handle.boundingBox()
  if (!box) throw new Error('Missing paragraph handle')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.locator('.mu-shadow')).toBeVisible()
}

test('selected list image survives Enter and continues the same level, including undo and saving', async() => {
  const imagePath = path.resolve(__dirname, '../../src/renderer/src/assets/images/logo.png').replaceAll('\\', '/')
  const { app, page, filePath } = await launchWithMarkdown(`- parent\n\n  ![photo](${imagePath})\n- sibling`, {
    suppressErrorDialog: true, preferences
  })
  try {
    const image = page.locator('.editor-component .mu-inline-image img')
    await expect(image).toBeVisible()
    await image.click()
    await page.keyboard.press('Enter')
    const items = page.locator('.editor-component > .mu-container > ul > li')
    await expect(items).toHaveCount(3)
    await expect(image).toHaveCount(1)
    await menuAction(app, 'Undo')
    await expect(items).toHaveCount(2)
    await menuAction(app, 'Redo')
    await expect(items).toHaveCount(3)
    await page.keyboard.type('after image')
    await expect(items.nth(1)).toContainText('after image')
    await page.keyboard.press('Enter')
    await page.keyboard.type('following item')
    await expect(items).toHaveCount(4)
    await menuAction(app, 'Save', 'File')
    await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toMatch(/- after image\n\s*- following item\n\s*- sibling/)
    await expect(image).toHaveCount(1)
    await expectNoRendererErrors(app)
    await page.screenshot({ path: 'test-results/list-image-continuation.png' })
  } finally {
    await app.close()
  }
})

test('selected words become a separate item at a nested list boundary with one undo step', async() => {
  const { app, page } = await launchWithMarkdown('keep MOVE tail\n\n- parent\n  - target\n    - child\n  - sibling', {
    suppressErrorDialog: true, preferences
  })
  try {
    const source = await selectLine(page, 'keep MOVE tail', 5, 9)
    const target = content(page, 'target')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing list target')
    const point = { clientX: box.x + 20, clientY: box.y + box.height - 2 }
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    const indicator = page.locator('.mu-text-drop-indicator[data-kind="item"]')
    await expect(indicator).toBeVisible()
    await page.screenshot({ path: 'test-results/selected-words-list-boundary.png' })
    await target.dispatchEvent('drop', { dataTransfer: transfer, ...point })
    const items = page.locator('.editor-component > .mu-container > ul > li').first().locator(':scope > ul > li')
    await expect(items).toHaveCount(3)
    await expect(items.nth(1)).toHaveText('MOVE')
    await expect(items.first().locator('ul > li')).toHaveText(['child'])
    await menuAction(app, 'Undo')
    await expect(items).toHaveCount(2)
    await expect(content(page, 'keep MOVE tail')).toHaveCount(1)
    await menuAction(app, 'Redo')
    await expect(items.nth(1)).toHaveText('MOVE')
    expect(await getMarkdownContent(page, app)).toContain('keep  tail\n\n- parent\n  - target\n    - child\n  - MOVE\n  - sibling')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('selected words become an independent paragraph in the gap before a paragraph', async() => {
  const { app, page } = await launchWithMarkdown('keep MOVE tail\n\ntarget paragraph', { suppressErrorDialog: true, preferences })
  try {
    const source = await selectLine(page, 'keep MOVE tail', 5, 9)
    const target = content(page, 'target paragraph')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing paragraph target')
    const point = { clientX: box.x + 20, clientY: box.y - 3 }
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    await expect(page.locator('.mu-text-drop-indicator[data-kind="item"]')).toBeVisible()
    await target.dispatchEvent('drop', { dataTransfer: transfer, ...point })
    const paragraphs = page.locator('.editor-component > .mu-container > p')
    await expect(paragraphs).toHaveCount(3)
    await expect(paragraphs.nth(1)).toHaveText('MOVE')
    await expect(paragraphs.nth(2)).toHaveText('target paragraph')
    expect((await getMarkdownContent(page, app)).trim()).toBe('keep  tail\n\nMOVE\n\ntarget paragraph')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('list indentation chooses the parent level when copying selected text as a new item', async() => {
  const { app, page } = await launchWithMarkdown('MOVE\n\n- parent\n  - target\n    - child\n- sibling', {
    suppressErrorDialog: true, preferences
  })
  try {
    const source = await selectLine(page, 'MOVE')
    const target = content(page, 'target')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing nested list')
    const point = { clientX: box.x - 14, clientY: box.y + box.height * 0.75, ctrlKey: true }
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    const indicator = page.locator('.mu-text-drop-indicator[data-kind="item"]')
    await expect(indicator).toBeVisible()
    const preview = await indicator.boundingBox()
    const parent = await content(page, 'parent').locator('xpath=ancestor::li[1]').boundingBox()
    if (!preview || !parent) throw new Error('Missing parent boundary')
    expect(Math.abs(preview.x - parent.x)).toBeLessThan(2)
    await target.dispatchEvent('drop', { dataTransfer: transfer, ...point })
    const items = page.locator('.editor-component > .mu-container > ul > li')
    await expect(items).toHaveCount(3)
    await expect(items.nth(1)).toHaveText('MOVE')
    await expect(page.locator('.editor-component > .mu-container > p').first()).toHaveText('MOVE')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('native drag moves a copied nested line with its children and supports undo, redo and save', async() => {
  const { app, page, filePath } = await launchWithMarkdown('- parent\n  - copied\n    - descendant\n  - target\n- sibling', {
    suppressErrorDialog: true, preferences
  })
  try {
    await selectLine(page, 'copied')
    await page.keyboard.press('Control+c')
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('copied')
    const source = await selectLine(page, 'copied')
    const sourceBox = await source.boundingBox()
    const targetBox = await content(page, 'target').boundingBox()
    if (!sourceBox || !targetBox) throw new Error('Missing drag bounds')
    await page.mouse.move(sourceBox.x + 12, sourceBox.y + sourceBox.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(250)
    await page.mouse.move(sourceBox.x + 30, sourceBox.y + sourceBox.height / 2, { steps: 5 })
    await page.mouse.move(targetBox.x + 25, targetBox.y + targetBox.height - 3, { steps: 15 })
    const indicator = page.locator('.mu-text-drop-indicator[data-kind="item"]')
    await expect(indicator).toBeVisible()
    const preview = await indicator.boundingBox()
    const item = await content(page, 'target').locator('xpath=ancestor::li[1]').boundingBox()
    if (!preview || !item) throw new Error('Missing drop preview')
    expect(Math.abs(preview.y + preview.height / 2 - (item.y + item.height))).toBeLessThan(2)
    expect(Math.abs(preview.x - item.x)).toBeLessThan(2)
    await page.screenshot({ path: 'test-results/list-drop-indicator.png' })
    await page.mouse.up()
    await expect(indicator).toHaveCount(0)
    const nested = page.locator('.editor-component > .mu-container > ul > li').first().locator(':scope > ul > li')
    await expect(nested).toHaveCount(2)
    await expect(nested.first()).toHaveText('target')
    await expect(nested.last()).toContainText('copied')
    await expect(nested.last().locator('ul > li')).toHaveText(['descendant'])
    await menuAction(app, 'Undo')
    await expect(nested.first()).toContainText('copied')
    await menuAction(app, 'Redo')
    await expect(nested.first()).toHaveText('target')
    await menuAction(app, 'Save', 'File')
    await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain('  - target\n  - copied\n    - descendant')
    const markdown = await getMarkdownContent(page, app)
    expect(markdown).toContain('descendant')
    await expect(nested.last().locator('ul > li')).toHaveText(['descendant'])
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

for (const copy of [false, true]) {
  test(`whole list line switches from a block boundary to an exact caret when ${copy ? 'copying' : 'moving'}`, async() => {
    const { app, page } = await launchWithMarkdown('- source\n  - child\n- target word', { suppressErrorDialog: true, preferences })
    try {
      const source = await selectLine(page, 'source')
      const target = content(page, 'target word')
      const sourceBox = await source.boundingBox()
      const targetBox = await target.boundingBox()
      if (!sourceBox || !targetBox) throw new Error('Missing drag bounds')
      const point = await target.evaluate(element => {
        const node = element.querySelector('.mu-plain-text')?.firstChild
        if (!node) throw new Error('Missing target text')
        const range = document.createRange()
        range.setStart(node, 6)
        range.collapse(true)
        const rect = range.getBoundingClientRect()
        return { x: rect.x, y: rect.y + rect.height / 2 }
      })
      await page.mouse.move(sourceBox.x + 12, sourceBox.y + sourceBox.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(250)
      await page.mouse.move(sourceBox.x + 30, sourceBox.y + sourceBox.height / 2, { steps: 5 })
      if (copy) await page.keyboard.down('Control')
      await page.mouse.move(targetBox.x + 25, targetBox.y + targetBox.height - 2, { steps: 10 })
      await expect(page.locator('.mu-text-drop-indicator[data-kind="item"]')).toBeVisible()
      await page.mouse.move(point.x, point.y, { steps: 8 })
      const indicator = page.locator('.mu-text-drop-indicator[data-kind="text"]')
      await expect(indicator).toBeVisible()
      const preview = await indicator.boundingBox()
      if (!preview) throw new Error('Missing caret preview')
      expect(Math.abs(preview.x - point.x)).toBeLessThan(2)
      await page.mouse.up()
      if (copy) await page.keyboard.up('Control')
      await expect(content(page, 'targetsource word')).toBeVisible()
      await expect(page.locator('.editor-component > .mu-container > ul > li')).toHaveCount(2)
      await expect(content(page, 'child')).toHaveCount(1)
      if (!copy) {
        await expect(page.locator('.editor-component > .mu-container > ul > li').first()).toHaveText('child')
        await expect(page.locator('.editor-component > .mu-container > ul > li > ul')).toHaveCount(0)
      }
      if (copy) await expect(content(page, 'source').first()).toHaveText('source')
      await menuAction(app, 'Undo')
      await expect(content(page, 'target word')).toBeVisible()
      await expect(content(page, 'source').first()).toHaveText('source')
      await menuAction(app, 'Redo')
      await expect(content(page, 'targetsource word')).toBeVisible()
      await expectNoRendererErrors(app)
    } finally {
      await page.keyboard.up('Control').catch(() => {})
      await app.close()
    }
  })
}

test('moving an entire ordered item into text removes its marker and renumbers the remaining list', async() => {
  const { app, page, filePath } = await launchWithMarkdown('3. source\n4. target word\n5. sibling', { suppressErrorDialog: true, preferences })
  try {
    const source = await selectLine(page, 'source')
    const target = content(page, 'target word')
    const point = await target.evaluate(element => {
      const node = element.querySelector('.mu-plain-text')?.firstChild
      if (!node) throw new Error('Missing target text')
      const range = document.createRange()
      range.setStart(node, 6)
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      return { clientX: rect.x, clientY: rect.y + rect.height / 2 }
    })
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('drop', { dataTransfer: transfer, ...point })
    const list = page.locator('.editor-component > .mu-container > ol')
    await expect(list.locator(':scope > li')).toHaveText(['targetsource word', 'sibling'])
    await expect(list).toHaveAttribute('start', '3')
    await menuAction(app, 'Undo')
    await expect(list.locator(':scope > li')).toHaveText(['source', 'target word', 'sibling'])
    await menuAction(app, 'Redo')
    await expect(list.locator(':scope > li')).toHaveText(['targetsource word', 'sibling'])
    await menuAction(app, 'Save', 'File')
    await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain('3. targetsource word\n4. sibling')
    expect(await getMarkdownContent(page, app)).toContain('3. targetsource word\n4. sibling')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('selected text drag hides the format toolbar until a fresh selection gesture', async() => {
  const { app, page } = await launchWithMarkdown('- source\n- target word', { suppressErrorDialog: true, preferences })
  try {
    const source = await selectLine(page, 'source')
    const toolbar = page.locator('.mu-format-picker-container')
    await source.dispatchEvent('click')
    await expect(toolbar).toHaveCSS('opacity', '1')
    const target = content(page, 'target word')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing target paragraph')
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await expect(toolbar).toHaveCSS('opacity', '0')
    await source.dispatchEvent('click')
    await page.evaluate(() => new Promise(requestAnimationFrame))
    await expect(toolbar).toHaveCSS('opacity', '0')
    await target.dispatchEvent('drop', { dataTransfer: transfer, clientX: box.x + 20, clientY: box.y + box.height / 2 })
    await page.locator('.editor-component').dispatchEvent('dragend')
    const moved = content(page, 'source')
    await expect(moved).toBeVisible()
    await moved.evaluate(element => {
      const node = element.querySelector('.mu-plain-text')
      const selection = document.getSelection()
      if (!node || !selection) throw new Error('Missing text selection')
      const range = document.createRange()
      range.selectNodeContents(node)
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await moved.dispatchEvent('click')
    await page.evaluate(() => new Promise(requestAnimationFrame))
    await expect(toolbar).toHaveCSS('opacity', '0')
    await moved.click()
    await moved.evaluate(element => {
      const node = element.querySelector('.mu-plain-text')
      const selection = document.getSelection()
      if (!node || !selection) throw new Error('Missing text selection')
      const range = document.createRange()
      range.selectNodeContents(node)
      selection.removeAllRanges()
      selection.addRange(range)
    })
    await moved.dispatchEvent('click')
    await expect(toolbar).toHaveCSS('opacity', '1')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('a selected image can be dragged natively into list text without losing children, including undo and save', async() => {
  const imagePath = path.resolve(__dirname, '../../src/renderer/src/assets/images/logo.png').replaceAll('\\', '/')
  const imageMarkdown = `![photo](${imagePath} "caption")`
  const { app, page, filePath } = await launchWithMarkdown(`- parent\n  - ${imageMarkdown}\n    - descendant\n  - target word\n- sibling`, { suppressErrorDialog: true, preferences })
  try {
    const image = page.locator('.editor-component .mu-inline-image img')
    await expect(image).toBeVisible()
    await image.click()
    await expect(page.locator('.mu-transformer .bar')).toHaveCount(2)
    const target = content(page, 'target word')
    const point = await target.evaluate(element => {
      const node = element.querySelector('.mu-plain-text')?.firstChild
      if (!node) throw new Error('Missing target text')
      const range = document.createRange()
      range.setStart(node, 6)
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      return { x: rect.x, y: rect.y + rect.height / 2 }
    })
    const box = await image.boundingBox()
    if (!box) throw new Error('Missing source image')
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2, { steps: 5 })
    await page.mouse.move(point.x, point.y, { steps: 15 })
    await expect(page.locator('.mu-text-drop-indicator[data-kind="text"]')).toBeVisible()
    await expect(page.locator('.mu-image-toolbar-container')).toHaveCSS('opacity', '0')
    await expect(page.locator('.mu-transformer .bar')).toHaveCount(0)
    await page.screenshot({ path: 'test-results/selected-image-caret-drop.png' })
    await page.mouse.up()
    await expect(image).toHaveCount(1)
    await expect(target.locator('img')).toHaveCount(1)
    const nested = page.locator('.editor-component > .mu-container > ul > li').first().locator(':scope > ul > li')
    await expect(nested).toHaveCount(2)
    await expect(nested.first()).toHaveText('descendant')
    await menuAction(app, 'Undo')
    await expect(nested).toHaveCount(2)
    await expect(nested.first().locator('img')).toHaveCount(1)
    await menuAction(app, 'Redo')
    await expect(target.locator('img')).toHaveCount(1)
    await menuAction(app, 'Save', 'File')
    await expect.poll(() => fs.readFileSync(filePath, 'utf8')).toContain(`  - descendant\n  - target${imageMarkdown} word`)
    expect(await getMarkdownContent(page, app)).toContain(`target${imageMarkdown} word`)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('selected image Ctrl drag creates a new nested task item and Escape preserves the original', async() => {
  const imagePath = path.resolve(__dirname, '../../src/renderer/src/assets/images/logo.png').replaceAll('\\', '/')
  const imageMarkdown = `![photo](${imagePath} "caption")`
  const initial = `${imageMarkdown}\n\n- parent\n  - [x] target`
  const { app, page } = await launchWithMarkdown(initial, { suppressErrorDialog: true, preferences })
  try {
    const image = page.locator('.editor-component .mu-inline-image img').first()
    await image.click()
    const target = content(page, 'target')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing target item')
    const point = { clientX: box.x + 20, clientY: box.y + box.height - 2, ctrlKey: true }
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await image.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    await expect(page.locator('.mu-text-drop-indicator[data-kind="item"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await image.dispatchEvent('dragend')
    expect((await getMarkdownContent(page, app)).trim()).toBe(initial)
    await image.click()
    await image.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    await target.dispatchEvent('drop', { dataTransfer: transfer, ...point })
    await expect(page.locator('.editor-component .mu-inline-image img')).toHaveCount(2)
    const tasks = page.locator('.editor-component > .mu-container > ul > li').first().locator(':scope > ul > li')
    await expect(tasks).toHaveCount(2)
    await expect(tasks.last().locator('img')).toHaveCount(1)
    expect(await getMarkdownContent(page, app)).toContain(`- [ ] ${imageMarkdown}`)
    await menuAction(app, 'Undo')
    await expect(page.locator('.editor-component .mu-inline-image img')).toHaveCount(1)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('dragging onto a descendant or cancelling a drag preserves text and undo history', async() => {
  const initial = '- parent\n  - child\n- sibling'
  const { app, page } = await launchWithMarkdown(initial, { suppressErrorDialog: true, preferences })
  try {
    const source = await selectLine(page, 'parent')
    const target = content(page, 'child')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing drop bounds')
    await source.dispatchEvent('dragstart', { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) })
    const rejected = await page.evaluateHandle(() => new DataTransfer())
    await target.dispatchEvent('dragover', { dataTransfer: rejected, clientX: box.x + 15, clientY: box.y + box.height / 2 })
    await expect(page.locator('.mu-text-drop-indicator')).toHaveCount(0)
    expect(await rejected.evaluate(transfer => transfer.dropEffect)).toBe('none')
    await target.dispatchEvent('drop', {
      dataTransfer: await page.evaluateHandle(() => new DataTransfer()), clientX: box.x + 15, clientY: box.y + box.height / 2
    })
    await source.dispatchEvent('dragend')
    expect((await getMarkdownContent(page, app)).trim()).toBe(initial)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('text drops show the exact caret, retain selection, and clear on Escape or leaving the editor', async() => {
  const { app, page } = await launchWithMarkdown('drag\n\ntarget word', { suppressErrorDialog: true, preferences })
  try {
    const source = await selectLine(page, 'drag')
    const target = content(page, 'target word')
    const point = await target.evaluate(element => {
      const text = element.querySelector('.mu-plain-text')?.firstChild
      if (!text) throw new Error('Missing target text')
      const range = document.createRange()
      range.setStart(text, 6)
      range.collapse(true)
      const rect = range.getBoundingClientRect()
      return { clientX: rect.left, clientY: rect.top + rect.height / 2, top: rect.top }
    })
    const transfer = await page.evaluateHandle(() => new DataTransfer())
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    const indicator = page.locator('.mu-text-drop-indicator[data-kind="text"]')
    await expect(indicator).toBeVisible()
    const box = await indicator.boundingBox()
    if (!box) throw new Error('Missing text caret preview')
    expect(Math.abs(box.x - point.clientX)).toBeLessThan(2)
    expect(Math.abs(box.y - point.top)).toBeLessThan(2)
    expect(await page.evaluate(() => document.getSelection()?.toString())).toBe('drag')
    await page.keyboard.press('Escape')
    await expect(indicator).toHaveCount(0)
    await source.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    await expect(indicator).toBeVisible()
    await page.locator('.editor-component').dispatchEvent('dragleave', { relatedTarget: null })
    await expect(indicator).toHaveCount(0)
    await target.dispatchEvent('dragover', { dataTransfer: transfer, ...point })
    await expect(indicator).toBeVisible()
    await target.dispatchEvent('drop', { dataTransfer: transfer, ...point })
    await expect(indicator).toHaveCount(0)
    expect(await getMarkdownContent(page, app)).toContain('targetdrag word')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('paragraph handle uses the same precise indicator and preserves the complete nested list', async() => {
  const initial = 'intro\n\n- parent\n  - child\n    - deep\n- sibling\n\nmiddle\n\ntarget'
  const { app, page } = await launchWithMarkdown(initial, { suppressErrorDialog: true, preferences })
  try {
    await holdFrontHandle(page, 'parent')
    const target = content(page, 'target')
    const box = await target.boundingBox()
    if (!box) throw new Error('Missing target paragraph')
    await page.mouse.move(box.x + 20, box.y + box.height / 4, { steps: 8 })
    const indicator = page.locator('.mu-text-drop-indicator[data-kind="item"]')
    await expect(indicator).toBeVisible()
    const preview = await indicator.boundingBox()
    const block = await target.locator('xpath=ancestor::p[1]').boundingBox()
    if (!preview || !block) throw new Error('Missing paragraph drop boundary')
    expect(Math.abs(preview.y + preview.height / 2 - block.y)).toBeLessThan(2)
    expect(Math.abs(preview.x - block.x)).toBeLessThan(2)
    expect(await indicator.evaluate(element => getComputedStyle(element).pointerEvents)).toBe('none')
    await page.screenshot({ path: 'test-results/front-handle-drop-indicator.png' })
    await page.mouse.up()
    await expect(indicator).toHaveCount(0)
    await expect(page.locator('.mu-shadow')).toHaveCount(0)
    const blocks = page.locator('.editor-component > .mu-container > *')
    await expect(blocks.nth(1)).toHaveText('middle')
    await expect(blocks.nth(2).locator('ul > li')).toContainText(['child', 'deep'])
    await menuAction(app, 'Undo')
    await expect(blocks.nth(1)).toContainText('parent')
    await menuAction(app, 'Redo')
    await expect(blocks.nth(1)).toHaveText('middle')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('paragraph handle clears its line and shadow on Escape and keeps the original document', async() => {
  const { app, page } = await launchWithMarkdown('first\n\nsecond\n\nthird', { suppressErrorDialog: true, preferences })
  try {
    await holdFrontHandle(page, 'first')
    const box = await content(page, 'third').boundingBox()
    if (!box) throw new Error('Missing target paragraph')
    await page.mouse.move(box.x + 20, box.y + box.height * 0.75, { steps: 6 })
    const indicator = page.locator('.mu-text-drop-indicator')
    await expect(indicator).toBeVisible()
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(indicator).toHaveCount(0)
    await expect(page.locator('.mu-shadow')).toHaveCount(0)
    expect((await getMarkdownContent(page, app)).trim()).toBe('first\n\nsecond\n\nthird')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
