import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  clickMenuById,
  expectNoRendererErrors,
  getMarkdownContent,
  launchWithMarkdown
} from './helpers'

test('horizontal rules render while editing in every built-in theme and appearance', async() => {
  const { app, page } = await launchWithMarkdown('before\n\n---\n\nafter\n', {
    suppressErrorDialog: true,
    preferences: { autoSave: false, appearance: 'system' }
  })
  try {
    const rule = page.locator('.mu-thematic-break')
    const readRule = () =>
      rule.evaluate((el) => {
        const style = getComputedStyle(el, '::before')
        return {
          visible: style.display !== 'none' && style.content !== 'none',
          color: style.borderTopColor,
          width: parseFloat(style.borderTopWidth),
          height: el.getBoundingClientRect().height
        }
      })
    for (const theme of ['github', 'academic', 'liber']) {
      await clickMenuById(app, theme)
      for (const appearance of ['light', 'dark'] as const) {
        await app.evaluate(({ nativeTheme }, value) => {
          nativeTheme.themeSource = value
        }, appearance)
        await expect
          .poll(() => page.locator('body').evaluate((el) => el.classList.contains('dark')))
          .toBe(appearance === 'dark')
        await page.locator('.mu-paragraph-content').last().click()
        await expect.poll(async() => (await readRule()).visible).toBe(true)
        expect((await readRule()).width).toBeGreaterThan(0)
        expect((await readRule()).height).toBeGreaterThan(0)
        await rule.click()
        await expect(rule).toHaveClass(/mu-active/)
        expect((await readRule()).visible).toBe(true)
        expect((await readRule()).color).not.toBe('rgba(0, 0, 0, 0)')
      }
    }
    await page.locator('.mu-paragraph-content').first().click()
    await clickMenuById(app, 'horizontalLineMenuItem')
    await expect(page.locator('.mu-thematic-break')).toHaveCount(2)
    await page.keyboard.type('inserted below the rule')
    // Serialization commits on animation frames before source mode reads it.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        )
    )
    expect(await getMarkdownContent(page, app)).toContain(
      'before\n\n---\n\ninserted below the rule'
    )
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

for (const [name, markdown, selector, tightSource, looseSource] of [
  ['bullet', '- one\n- two\n', '.mu-bullet-list', '- one\n- two', '- one\n\n- two'],
  ['ordered', '1. one\n2. two\n', '.mu-order-list', '1. one\n2. two', '1. one\n\n2. two'],
  [
    'task',
    '- [ ] one\n- [x] two\n',
    '.mu-task-list',
    '- [ ] one\n- [x] two',
    '- [ ] one\n\n- [x] two'
  ]
]) {
  test(`${name} lists toggle their visible spacing and saved blank lines`, async() => {
    const { app, page } = await launchWithMarkdown(markdown, {
      suppressErrorDialog: true,
      preferences: { autoSave: false }
    })
    try {
      const list = page.locator(selector)
      const gap = () =>
        list
          .locator(':scope > li')
          .evaluateAll(
            (els) => els[1].getBoundingClientRect().top - els[0].getBoundingClientRect().bottom
          )
      await expect(list).toHaveClass(/mu-tight-list/)
      const tightGap = await gap()
      await list.locator('.mu-paragraph-content').first().click()
      await clickMenuById(app, 'looseListItemMenuItem')
      await expect(list).not.toHaveClass(/mu-tight-list/)
      expect(await gap()).toBeGreaterThan(tightGap + 4)
      expect(await getMarkdownContent(page, app)).toContain(looseSource)
      await list.locator('.mu-paragraph-content').first().click()
      await clickMenuById(app, 'looseListItemMenuItem')
      await expect(list).toHaveClass(/mu-tight-list/)
      expect(await gap()).toBeCloseTo(tightGap, 0)
      expect(await getMarkdownContent(page, app)).toContain(tightSource)
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })
}

for (const [format, fence, text] of [
  ['-', '---', 'title: Example'],
  ['+', '+++', 'title = "Example"'],
  [';', ';;;', '"title": "Example"'],
  ['{', '{', '"title": "Example"']
]) {
  test(`front matter ${format} inserts once at the start and preserves document content`, async() => {
    const { app, page } = await launchWithMarkdown('body\n\nlast\n', {
      suppressErrorDialog: true,
      preferences: { autoSave: false, frontmatterType: format }
    })
    try {
      await page.locator('.mu-paragraph-content').last().click()
      await clickMenuById(app, 'frontMatterMenuItem')
      await expect(page.locator('.mu-frontmatter')).toHaveCount(1)
      await expect(page.locator('.mu-container > :first-child')).toHaveClass(/mu-frontmatter/)
      await expect(page.locator('.mu-frontmatter')).toHaveAttribute('frontMatterStart', fence)
      await page.keyboard.type(text)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      )
      expect(await getMarkdownContent(page, app)).toContain(
        `${fence}\n${text}\n${format === '{' ? '}' : fence}`
      )
      await page.locator('.mu-paragraph-content').last().click()
      await clickMenuById(app, 'frontMatterMenuItem')
      await expect(page.locator('.mu-frontmatter')).toHaveCount(1)
      await expect(page.locator('.mu-paragraph-content')).toHaveText(['body', 'last'])
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })
}

test('settings and paragraph menus explain lists and metadata and omit the retired heading preference', async() => {
  const { app } = await launchWithMarkdown('body', {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', autoSave: false, preferHeadingStyle: 'setext' }
  })
  try {
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = (async(...args: unknown[]) => {
        const state = globalThis as typeof globalThis & { lastInformation?: unknown }
        state.lastInformation = args[args.length - 1]
        return { response: 0, checkboxChecked: false }
      }) as typeof dialog.showMessageBox
    })
    for (const [id, title, snippet] of [
      ['looseListItemHelpMenuItem', '宽松列表项', '空行'],
      ['frontMatterHelpMenuItem', '前置元数据', 'title: 我的文章']
    ]) {
      await clickMenuById(app, id)
      const info = await app.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              lastInformation?: { type: string; title: string; detail: string }
            }
          ).lastInformation
      )
      expect(info?.type).toBe('info')
      expect(info?.title).toBe(title)
      expect(info?.detail).toContain(snippet)
    }
    const newWindow = app.waitForEvent('window')
    await app.evaluate(({ ipcMain }) => {
      ipcMain.emit('app-create-settings-window')
    })
    const settings = await newWindow
    await settings.locator('.pref-sidebar .category .item').filter({ hasText: 'Markdown' }).click()
    await expect(settings.locator('.pref-markdown')).toBeVisible()
    await expect(settings.locator('.pref-markdown .ag-underdevelop')).toHaveCount(0)
    await expect(settings.getByText('首选标题样式', { exact: true })).toHaveCount(0)
    const looseHelp = settings
      .locator('.pref-switch-item')
      .filter({ hasText: '首选宽松列表项' })
      .getByRole('button')
    await looseHelp.hover()
    await expect(settings.locator('.pref-info-tooltip:visible')).toContainText('空行')
    await looseHelp.focus()
    await expect(looseHelp).toBeFocused()
    const frontHelp = settings
      .locator('.pref-select-item')
      .filter({ hasText: '前置元数据类型' })
      .getByRole('button')
    await frontHelp.focus()
    await frontHelp.hover()
    await expect(
      settings.getByRole('tooltip').filter({ hasText: '已有元数据保持原格式' })
    ).toBeVisible()
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    const saved = JSON.parse(readFileSync(path.join(userData, 'preferences.json'), 'utf8'))
    expect(saved.preferHeadingStyle).toBeUndefined()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
