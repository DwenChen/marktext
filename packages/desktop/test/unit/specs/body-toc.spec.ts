import { describe, expect, it } from 'vitest'
import { findBodyToc } from '@/util/bodyToc'

const detect = (html: string) =>
  findBodyToc(new DOMParser().parseFromString(html, 'text/html').body)

describe('body contents section detection', () => {
  it.each(['目录', '目次', 'Table of Contents', 'Contents', 'TOC'])(
    'recognizes %s with nested anchor entries',
    (title) => {
      const result = detect(`<h2>${title}</h2><ul><li><a href="#chapter">Chapter</a>
      <ol><li><p><a href="#child">Child <code>int</code></a></p></li></ol></li></ul>
      <p>Body after contents</p><ul><li><a href="#elsewhere">Ordinary navigation</a></li></ul>`)
      expect(result.nodes.map((node) => node.tagName)).toEqual(['H2', 'UL'])
      expect(result.markers).toHaveLength(0)
    }
  )

  it('recognizes a plain label and standalone markers, including multiple markers', () => {
    const result = detect('<p><strong>目录</strong></p><p>[TOC]</p><h1>Chapter</h1><p>[toc]</p>')
    expect(result.nodes).toHaveLength(3)
    expect(result.markers).toHaveLength(2)
  })

  it.each([
    '<h1>目录</h1><p>How directories work</p><ul><li><a href="#file">File</a></li></ul>',
    '<h2>目录</h2><ul><li><a href="https://example.com">External reference</a></li></ul>',
    '<h2>目录</h2><ul><li><a href="#chapter">Chapter</a> Important explanation</li></ul>',
    '<h2>文件目录</h2><ul><li><a href="#file">File</a></li></ul>',
    '<ul><li><a href="#chapter">Body navigation</a></li></ul>',
    '<pre><code>[TOC]</code></pre><blockquote><p>[TOC]</p><h2>目录</h2><ul><li><a href="#chapter">Chapter</a></li></ul></blockquote>',
    '<p><code>[TOC]</code></p><p>Discuss [TOC] here</p>',
    '<h2>目录</h2><ul><li><input type="checkbox"><a href="#task">Task</a></li></ul>'
  ])('leaves prose, examples, and ordinary lists alone: %s', (html) => {
    expect(detect(html).nodes).toHaveLength(0)
  })
})
