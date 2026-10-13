import { expect, test } from '@playwright/test'
import { clickMenuById, enterSourceMode, exitSourceMode, expectNoRendererErrors, getMarkdownContent, launchWithMarkdown, setSourceMarkdown } from './helpers'

const markdown = '# Source mode visibility\n\n正文内容不应与源码叠加。\n\n> [!NOTE]\n> 模式切换应保留文档。\n\n- First\n- Second\n'

test('source mode shows one editor across document themes and appearances', async() => {
  test.setTimeout(60000)
  const { app, page } = await launchWithMarkdown(markdown, {
    suppressErrorDialog: true,
    preferences: { language: 'en', appearance: 'light' }
  })
  try {
    if (process.env.MARKTEXT_E2E_APP_PATH) await setSourceMarkdown(page, app, markdown)
    let current = markdown
    for (const theme of ['github', 'academic', 'liber']) {
      await clickMenuById(app, theme)
      for (const appearance of ['Light', 'Dark']) {
        await page.locator('.appearance-switch').click()
        await page.locator('.appearance-menu .el-dropdown-menu__item').filter({ hasText: new RegExp(`^${appearance}$`) }).click()
        await enterSourceMode(page, app)
        await expect(page.locator('.source-code .CodeMirror')).toBeVisible()
        await expect(page.locator('.editor-component')).toBeHidden()
        expect(await page.locator('.source-code .CodeMirror').evaluate(el => {
          const rect = el.getBoundingClientRect()
          return document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
            .some(element => element.closest('.editor-wrapper'))
        })).toBe(false)
        const heading = `Source mode ${theme} ${appearance}`
        current = current.replace(/^# .+/, `# ${heading}`)
        await page.evaluate(value => {
          const el = document.querySelector('.source-code .CodeMirror') as Element & { CodeMirror: { setValue(value: string): void } }
          el.CodeMirror.setValue(value)
        }, current)
        await page.screenshot({ path: `test-results/source-mode-${theme}-${appearance.toLowerCase()}.png` })
        await exitSourceMode(page, app)
        await expect(page.locator('.editor-component')).toBeVisible()
        await expect(page.locator('.mu-container > h1')).toContainText(heading)
        await expect(page.locator('.source-code')).toHaveCount(0)
        expect(await getMarkdownContent(page, app)).toBe(current)
      }
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})
