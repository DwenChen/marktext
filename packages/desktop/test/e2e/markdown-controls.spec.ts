import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  clickMenuById,
  enterSourceMode,
  expectNoRendererErrors,
  exitSourceMode,
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

test('settings keep list and metadata tips while paragraph menus omit help entries', async() => {
  const { app } = await launchWithMarkdown('body', {
    suppressErrorDialog: true,
    preferences: { language: 'zh-CN', autoSave: false, preferHeadingStyle: 'setext' }
  })
  try {
    expect(
      await app.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu()!
        return ['looseListItemHelpMenuItem', 'frontMatterHelpMenuItem'].map(
          (id) => !!menu.getMenuItemById(id)
        )
      })
    ).toEqual([false, false])
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

test('compact heading submenu preserves commands, checked states and context restrictions', async() => {
  const { app, page } = await launchWithMarkdown('# Heading\n\nbody\n\n```js\nconst x = 1\n```\n', {
    suppressErrorDialog: true,
    preferences: {
      language: 'zh-CN',
      titleBarStyle: 'custom',
      sideBarVisibility: false,
      autoSave: false
    }
  })
  try {
    const readHeadings = () =>
      app.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu()!
        const heading = menu.getMenuItemById('headingMenuEntry')!
        return {
          enabled: heading.enabled,
          children: heading
            .submenu!.items.filter((item) => item.id)
            .map((item) => ({
              id: item.id,
              checked: item.checked,
              enabled: item.enabled
            })),
          topLevel: menu
            .getMenuItemById('paragraphMenuEntry')!
            .submenu!.items.map((item) => item.id)
        }
      })
    await page.locator('h1 .mu-atxheading-content').click()
    await expect.poll(async() => (await readHeadings()).children[0].checked).toBe(true)
    const initial = await readHeadings()
    expect(initial.topLevel).toContain('headingMenuEntry')
    expect(initial.topLevel).not.toContain('heading1MenuItem')
    expect(initial.children.map((item) => item.id)).toEqual([
      'heading1MenuItem',
      'heading2MenuItem',
      'heading3MenuItem',
      'heading4MenuItem',
      'heading5MenuItem',
      'heading6MenuItem',
      'upgradeHeadingMenuItem',
      'degradeHeadingMenuItem'
    ])
    if (process.platform !== 'darwin') {
      if (await page.locator('.side-bar').isVisible()) await clickMenuById(app, 'sideBarMenuItem')
      await expect(page.locator('.side-bar')).toBeHidden()
      await page.locator('.frameless-titlebar-menu').click()
      await page.getByRole('menuitem', { name: '段落', exact: true }).hover()
      await expect(page.getByRole('menuitemcheckbox', { name: '标题 1', exact: true })).toHaveCount(
        0
      )
      await page.getByRole('menuitem', { name: '标题', exact: true }).hover()
      await expect(
        page.getByRole('menuitemcheckbox', { name: '标题 1', exact: true })
      ).toHaveAttribute('aria-checked', 'true')
      await page.screenshot({ path: 'test-results/compact-heading-menu.png' })
      await page.getByRole('menuitemcheckbox', { name: '标题 4', exact: true }).click()
      await expect(page.locator('h4 .mu-atxheading-content')).toContainText('Heading')
    }
    for (let level = 1; level <= 6; level++) {
      await clickMenuById(app, `heading${level}MenuItem`)
      await expect(page.locator(`h${level} .mu-atxheading-content`)).toContainText('Heading')
      await expect
        .poll(async() =>
          (await readHeadings()).children.filter((item) => item.checked).map((item) => item.id)
        )
        .toEqual([`heading${level}MenuItem`])
    }
    const accelerators = await app.evaluate(({ Menu }) =>
      ['upgradeHeadingMenuItem', 'degradeHeadingMenuItem'].map(
        (id) => Menu.getApplicationMenu()!.getMenuItemById(id)!.accelerator
      )
    )
    expect(accelerators.every(Boolean)).toBe(true)
    await clickMenuById(app, 'upgradeHeadingMenuItem')
    await expect(page.locator('h5 .mu-atxheading-content')).toContainText('Heading')
    await clickMenuById(app, 'degradeHeadingMenuItem')
    await expect(page.locator('h6 .mu-atxheading-content')).toContainText('Heading')
    await enterSourceMode(page, app)
    await expect
      .poll(async() => {
        const state = await readHeadings()
        return !state.enabled && state.children.every((item) => !item.enabled)
      })
      .toBe(true)
    await exitSourceMode(page, app)
    await page.locator('h6 .mu-atxheading-content').click()
    await expect
      .poll(async() => (await readHeadings()).children.every((item) => item.enabled))
      .toBe(true)
    await page.evaluate(() => {
      const heading = document.querySelector('h6 .mu-atxheading-content')!
      const body = document.querySelector('.mu-paragraph-content')!
      const range = document.createRange()
      range.setStart(heading, 0)
      range.setEnd(body, body.childNodes.length)
      const selection = document.getSelection()!
      selection.removeAllRanges()
      selection.addRange(range)
      body.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })
    await expect
      .poll(async() => (await readHeadings()).children.every((item) => !item.enabled))
      .toBe(true)
    await page.locator('.mu-codeblock-content').click()
    await expect.poll(async() => (await readHeadings()).enabled).toBe(false)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('folder empty state stays below opened files with a full-width working button', async() => {
  const { app, page } = await launchWithMarkdown('sidebar', {
    suppressErrorDialog: true,
    preferences: {
      language: 'zh-CN',
      titleBarStyle: 'custom',
      sideBarVisibility: true,
      openedFilesInSidebar: true,
      autoSave: false
    }
  })
  try {
    const empty = page.locator('.open-project')
    const button = empty.getByRole('button', { name: '打开文件夹', exact: true })
    if (await page.locator('.close-project').isVisible())
      await page.locator('.close-project').click()
    await expect(empty.locator('p')).toHaveText('尚未打开文件夹。')
    const checkLayout = async() => {
      const geometry = await page.evaluate(() => {
        const bounds = (selector: string) =>
          document.querySelector(selector)!.getBoundingClientRect().toJSON()
        return {
          files: document.querySelector('.opened-files')?.getBoundingClientRect().toJSON(),
          tree: bounds('.tree-view'),
          empty: bounds('.open-project'),
          message: bounds('.open-project p'),
          button: bounds('.open-project button')
        }
      })
      expect(geometry.empty.top).toBe(geometry.files?.bottom ?? geometry.tree.top)
      expect(geometry.message.left - geometry.empty.left).toBe(16)
      expect(geometry.button.left).toBe(geometry.message.left)
      expect(geometry.button.width).toBe(geometry.empty.width - 32)
      expect(geometry.button.top).toBe(geometry.message.bottom + 12)
      expect(geometry.button.bottom).toBeLessThanOrEqual(geometry.tree.bottom)
    }
    await checkLayout()
    for (let i = 0; i < 6; i++) {
      await app.evaluate(({ Menu, BrowserWindow }) => {
        const item = Menu.getApplicationMenu()!
          .items.find((item) => item.label === '文件')!
          .submenu!.items.find((item) => item.label === '新建标签页')!
        const win = BrowserWindow.getAllWindows()[0]
        item.click(undefined, win, win.webContents)
      })
      await expect(page.locator('.opened-files-list .opened-file')).toHaveCount(i + 2)
    }
    await expect(page.locator('.opened-files-list .opened-file')).toHaveCount(7)
    await checkLayout()
    expect(
      await page.locator('.opened-files-list').evaluate((el) => el.scrollHeight > el.clientHeight)
    ).toBe(true)
    await page.locator('.opened-files > .title > span').click()
    await expect(page.locator('.opened-files-list')).toBeHidden()
    await checkLayout()
    await page.screenshot({ path: 'test-results/folder-empty-state.png' })
    await page.locator('.opened-files > .title > span').click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(640, 480))
    await page.locator('.drag-bar').focus()
    await page.keyboard.press('Home')
    await checkLayout()
    await page.evaluate(() =>
      window.electron.ipcRenderer.send('mt::set-user-preference', { openedFilesInSidebar: false })
    )
    await expect(page.locator('.opened-files')).toHaveCount(0)
    await checkLayout()
    await app.evaluate(({ dialog }) => {
      const state = globalThis as typeof globalThis & { folderDialogProperties?: string[] }
      dialog.showOpenDialog = (async(...args: unknown[]) => {
        state.folderDialogProperties = (
          args[args.length - 1] as Electron.OpenDialogOptions
        ).properties
        return { canceled: true, filePaths: [] }
      }) as typeof dialog.showOpenDialog
    })
    await button.click()
    await expect
      .poll(() =>
        app.evaluate(
          () =>
            (globalThis as typeof globalThis & { folderDialogProperties?: string[] })
              .folderDialogProperties
        )
      )
      .toContain('openDirectory')
    await expect(empty).toBeVisible()
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
