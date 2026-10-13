import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import {
  clickMenuById, expectNoRendererErrors, getMarkdownContent, launchWithMarkdown,
  sendIpcToRenderer, setSourceMarkdown
} from './helpers'

const DOC = `# 目录

- [如何使用本笔记](#如何使用本笔记)
  - [关于学习时长](#关于学习时长)
  - [相关链接](#相关链接)
- [第 1 章 Python 安装和 VENV 的使用](#第-1-章-python-安装和-venv-的使用)
- [第 2 章 变量和基本数据类型](#第-2-章-变量和基本数据类型)
  - [数字 \`float\` 和 \`int\`](#数字-float-和-int)
  - [字符串 \`str\` 和字节序列 \`bytes\`](#字符串-str-和字节序列-bytes)

# 如何使用本笔记

这段正文必须保留。

## 关于学习时长

每章阅读和练习。

## 相关链接

[普通正文链接](#关于学习时长)

# 第 1 章 Python 安装和 VENV 的使用

安装 Python。

# 第 2 章 变量和基本数据类型

## 数字 \`float\` 和 \`int\`

数字正文。

## 字符串 \`str\` 和字节序列 \`bytes\`

结束正文。`

// eslint-disable-next-line no-empty-pattern -- Electron owns the browser windows.
test('nested contents lists match the live theme in exported HTML', async({}, testInfo) => {
  test.setTimeout(120000)
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true, preferences: { appearance: 'light', language: 'en' }
  })
  try {
    if (process.env.MARKTEXT_E2E_APP_PATH) await setSourceMarkdown(page, app, DOC)
    await page.locator('.mu-paragraph-content').last().click()
    for (const theme of ['github', 'academic', 'liber']) {
      await clickMenuById(app, theme)
      const list = page.locator('.mu-container > ul').first()
      const live = await list.evaluate(element => {
        const first = element.querySelector('li')?.getBoundingClientRect()
        if (!first) throw new Error('The contents list is empty')
        return {
          height: element.getBoundingClientRect().height,
          entries: Array.from(element.querySelectorAll('.mu-link')).map(link => {
            const rect = link.getBoundingClientRect()
            return { x: rect.x - first.x, y: rect.y - first.y, width: rect.width }
          })
        }
      })
      const output = testInfo.outputPath(`contents-${theme}.html`)
      await app.evaluate(({ dialog }, filename) => {
        dialog.showSaveDialog = async() => ({ canceled: false, filePath: filename })
      }, output)
      await sendIpcToRenderer(app, 'mt::show-export-dialog', 'styledHtml')
      await page.locator('.export-settings-dialog .button-primary').click()
      await expect.poll(() => existsSync(output), { timeout: 30000 }).toBe(true)
      const window = app.waitForEvent('window')
      await app.evaluate(({ BrowserWindow }, filename) => {
        const preview = new BrowserWindow({ width: 1280, height: 1000 })
        void preview.loadFile(filename)
      }, output)
      const preview = await window
      await preview.waitForLoadState('load')
      await preview.evaluate(() => document.fonts.ready)
      const exported = await preview.locator('.markdown-body > ul').first().evaluate(element => {
        const first = element.querySelector('li')?.getBoundingClientRect()
        if (!first) throw new Error('The contents list is empty')
        return {
          height: element.getBoundingClientRect().height,
          entries: Array.from(element.querySelectorAll('a')).map(link => {
            const rect = link.getBoundingClientRect()
            return { x: rect.x - first.x, y: rect.y - first.y, width: rect.width }
          })
        }
      })
      await preview.screenshot({ path: testInfo.outputPath(`contents-${theme}-export.png`) })
      await list.scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`contents-${theme}-live.png`) })
      expect(exported.entries).toHaveLength(live.entries.length)
      expect(Math.abs(exported.height - live.height)).toBeLessThan(1)
      for (let index = 0; index < live.entries.length; index++) {
        expect(Math.abs(exported.entries[index].x - live.entries[index].x)).toBeLessThan(1)
        expect(Math.abs(exported.entries[index].y - live.entries[index].y)).toBeLessThan(1)
        expect(Math.abs(exported.entries[index].width - live.entries[index].width)).toBeLessThan(1)
      }
      await preview.close()
    }
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})

// eslint-disable-next-line no-empty-pattern -- Electron owns the browser windows.
test('body contents visibility applies to actual HTML, PDF and PNG exports without changing the document', async({}, testInfo) => {
  test.setTimeout(120000)
  const { app, page } = await launchWithMarkdown(DOC, {
    suppressErrorDialog: true, preferences: { appearance: 'light', language: 'en', theme: 'github' }
  })
  try {
    if (process.env.MARKTEXT_E2E_APP_PATH) await setSourceMarkdown(page, app, DOC)
    const source = await getMarkdownContent(page, app)
    if (!(await page.locator('.side-bar-toc').isVisible())) await clickMenuById(app, 'tocMenuItem')
    await expect(page.locator('.side-bar-toc')).toBeVisible()
    const outline = await page.locator('.side-bar-toc').textContent()
    const files: Record<string, string> = {}
    const pngHeights: number[] = []
    for (const include of [true, false]) {
      for (const type of ['styledHtml', 'pdf', 'png']) {
        const output = testInfo.outputPath(`contents-${include ? 'included' : 'omitted'}.${type === 'styledHtml' ? 'html' : type}`)
        files[`${type}-${include}`] = output
        await app.evaluate(({ dialog }, filename) => {
          dialog.showSaveDialog = async() => ({ canceled: false, filePath: filename })
        }, output)
        await sendIpcToRenderer(app, 'mt::show-export-dialog', type)
        const popup = page.locator('.export-settings-dialog:visible')
        const toggle = popup.locator('.body-toc-options [role="switch"]')
        await expect(popup.locator('.body-toc-options')).toBeVisible()
        await expect(popup.locator('.body-toc-options')).toContainText('Show contents section in document body')
        if ((await toggle.getAttribute('aria-checked')) !== String(include)) {
          await popup.locator('.body-toc-options .el-switch').click()
        }
        await expect(toggle).toHaveAttribute('aria-checked', String(include))
        await popup.locator('.button-primary').click()
        await expect.poll(() => existsSync(output) && readFileSync(output).length > 0, { timeout: 30000 }).toBe(true)
        const data = readFileSync(output)
        if (type === 'styledHtml') {
          const contents = await page.evaluate(html => {
            const doc = new DOMParser().parseFromString(html, 'text/html')
            return {
              titles: Array.from(doc.querySelectorAll('article > h1')).map(heading => heading.textContent),
              list: !!doc.querySelector('article > ul'),
              link: doc.querySelector('article > p > a')?.textContent,
              body: doc.querySelector('article')?.textContent
            }
          }, data.toString())
          expect(contents.list).toBe(include)
          expect(contents.titles.includes('目录')).toBe(include)
          expect(contents.link).toBe('普通正文链接')
          expect(contents.body).toContain('这段正文必须保留。')
        } else if (type === 'pdf') {
          expect(data.subarray(0, 5).toString()).toBe('%PDF-')
        } else {
          expect(data.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
          expect(data.readUInt32BE(16)).toBe(1200)
          pngHeights.push(data.readUInt32BE(20))
        }
      }
      expect(await page.locator('.side-bar-toc').textContent()).toBe(outline)
      expect(await getMarkdownContent(page, app)).toBe(source)
    }
    expect(pngHeights[0] - pngHeights[1]).toBeGreaterThan(150)
    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'styledHtml')
    await expect(page.locator('.body-toc-options [role="switch"]')).toHaveAttribute('aria-checked', 'false')
    await page.locator('.export-settings-dialog .button-secondary').click()
    await setSourceMarkdown(page, app, '# 目录\n\n这是介绍文件目录的普通章节。\n\n```md\n[TOC]\n```')
    await sendIpcToRenderer(app, 'mt::show-export-dialog', 'styledHtml')
    await expect(page.locator('.body-toc-options')).toHaveCount(0)
    await page.locator('.export-settings-dialog .button-secondary').click()
    writeFileSync(testInfo.outputPath('exports.json'), JSON.stringify(files, null, 2))
    await expectNoRendererErrors(app)
  } finally { await app.close() }
})
