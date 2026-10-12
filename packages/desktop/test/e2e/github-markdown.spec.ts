import { expect, test } from '@playwright/test'
import { enterSourceMode, exitSourceMode, expectNoRendererErrors, getMarkdownContent, launchWithMarkdown } from './helpers'

const markdown = `# GitHub Markdown

> [!NOTE]
> 中文说明 **加粗**。

> [!TIP]
> Use Python.

> [!IMPORTANT]
> Save your work.

> [!WARNING]
> Be careful.

> [!CAUTION]
> Check the result.

Footnote[^one], $\`x^2\`$, @DwenChen and DwenChen/marktext#1.

[^one]: Footnote content.

<details>
<summary>Read more</summary>

**Collapsed body**

</details>

\`\`\`geojson
{"type":"Point","coordinates":[121,31]}
\`\`\`

\`\`\`topojson
{"type":"Topology","objects":{"line":{"type":"LineString","arcs":[0]}},"arcs":[[[0,0],[1,1]]]}
\`\`\`

\`\`\`stl
solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid triangle
\`\`\`
`

test('github extensions render and survive switching editing modes', async() => {
  const { app, page } = await launchWithMarkdown(markdown, { suppressErrorDialog: true })
  try {
    await expect(page.locator('.mu-github-alert')).toHaveCount(5)
    for (const type of ['note', 'tip', 'important', 'warning', 'caution']) {
      const alert = page.locator(`.mu-github-alert.markdown-alert-${type}`)
      await expect(alert.locator('.mu-alert-marker')).toHaveCount(1)
      const style = await alert.evaluate(el => getComputedStyle(el).borderLeftColor)
      expect(style).not.toBe('rgba(0, 0, 0, 0)')
    }
    await expect(page.locator('.github-geometry svg')).toHaveCount(3)
    await expect(page.locator('.mu-html-preview details')).toHaveCount(1)
    const details = page.locator('.mu-html-preview details')
    await details.locator('summary').click()
    await expect(details).toHaveAttribute('open', '')
    await expect(details.locator('strong')).toHaveText('Collapsed body')
    await expect(page.locator('.mu-footnote')).toHaveCount(1)
    await enterSourceMode(page, app)
    const source = await getMarkdownContent(page, app)
    for (const marker of ['[!NOTE]', '[!CAUTION]', '[^one]', '<details>', '```geojson', '```topojson', '```stl'])
      expect(source).toContain(marker)
    await exitSourceMode(page, app)
    await expect(page.locator('.mu-github-alert')).toHaveCount(5)
    await expect(page.locator('.github-geometry svg')).toHaveCount(3)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
