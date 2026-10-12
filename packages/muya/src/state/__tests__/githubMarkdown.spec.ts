// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { renderGithubGeometry } from '../../utils/diagram/githubGeometry';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import HtmlToMarkdown from '../htmlToMarkdown';
import { MarkdownToHtml } from '../markdownToHtml';
import { MarkdownToState } from '../markdownToState';
import { renderToStaticHTML } from '../renderToStaticHTML';
import ExportMarkdown from '../stateToMarkdown';

const STL = `solid triangle
facet normal 0 0 1
outer loop
vertex 0 0 0
vertex 1 0 0
vertex 0 1 0
endloop
endfacet
endsolid triangle`;
const GEOJSON = JSON.stringify({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]], [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.1]]] } });
const TOPOJSON = JSON.stringify({ type: 'Topology', transform: { scale: [0.5, 0.5], translate: [10, 10] }, objects: { line: { type: 'LineString', arcs: [0, -2] } }, arcs: [[[0, 0], [2, 0]], [[2, 2], [0, -2]]] });

afterEach(() => {
    document.body.replaceChildren();
});

describe('github markdown extensions', () => {
    it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('renders %s without losing the body or source', async (type) => {
        const markdown = `> [!${type}]\n> 中文 **body** and [link][ref]\n>\n> - item\n\n[ref]: https://github.com\n`;
        const output = await new MarkdownToHtml(markdown).renderHtml();
        expect(output).toContain(`markdown-alert-${type.toLowerCase()}`);
        expect(output).toContain('<strong>body</strong>');
        expect(output).toContain('href="https://github.com"');
        expect(output).toContain('<li>item</li>');
        expect(output).not.toContain(`[!${type}]`);
        expect(getClipBoardHtml(markdown)).toContain('markdown-alert-title');
        const pasted = new HtmlToMarkdown().generate(getClipBoardHtml(markdown));
        expect(pasted).toContain(`> [!${type}]`);
        expect(renderToStaticHTML(pasted)).toContain(`markdown-alert-${type.toLowerCase()}`);
        const state = new MarkdownToState().generate(markdown);
        expect(new ExportMarkdown().generate(state)).toContain(`[!${type}]`);
    });

    it('does not reinterpret ordinary quotes, escaped markers, inline code or fences', () => {
        const source = '> ordinary\n\n> \\[!TIP]\n\n> intro\n> [!NOTE]\n\n`[!WARNING]`\n\n```md\n> [!CAUTION]\n```';
        expect(renderToStaticHTML(source)).not.toContain('markdown-alert-');
        expect(renderToStaticHTML('> [!NOTE] same line')).not.toContain('markdown-alert-');
    });

    it('supports default footnotes, both github math forms, safe HTML and GFM', () => {
        const html = renderToStaticHTML('H<sub>2</sub>O x<sup>2</sup> <ins>new</ins> ~~old~~\n\n- [x] done\n\n|a|b|\n|-|-|\n|1|2|\n\nhttps://github.com :smile: [^note] $`x^2`$\n\n```math\nx^2\n```\n\n[^note]: A note\n\n<!-- hidden -->\n<script>alert(1)</script>');
        for (const fragment of ['<sub>2</sub>', '<sup>2</sup>', '<ins>new</ins>', '<del>old</del>', '<table>', 'type="checkbox"', 'footnotes', 'katex'])
            expect(html).toContain(fragment);
        expect(html).not.toContain('<script');
        expect(html).not.toContain('<!-- hidden');
    });

    it('keeps nested details intact across edit and export', async () => {
        const source = '<details>\n<summary>Read more</summary>\n\n**bold**\n\n<details>\n<summary>Nested</summary>\n\n- item\n\n</details>\n\n</details>';
        const state = new MarkdownToState().generate(source);
        expect(state).toHaveLength(1);
        expect(state[0].name).toBe('html-block');
        expect(new ExportMarkdown().generate(state).trim()).toBe(source);
        const dom = document.createElement('div');
        dom.innerHTML = await new MarkdownToHtml(source).renderHtml();
        expect(dom.querySelectorAll('details')).toHaveLength(2);
        expect(dom.querySelector('strong')?.textContent).toBe('bold');
        expect(dom.querySelector('li')?.textContent).toBe('item');
    });

    it('renders alert markers while keeping editor offsets and live changes', () => {
        window.MUYA_VERSION = 'test';
        const host = document.createElement('div');
        document.body.append(host);
        const muya = new Muya(host, { markdown: '> [!TIP]\n> 中文 body' });
        muya.init();
        const root = muya.domNode;
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        first.update();
        expect(root.querySelector('.mu-github-alert.markdown-alert-tip')).not.toBeNull();
        expect(root.querySelector('.mu-alert-marker')?.getAttribute('data-title')).toContain('Tip');
        expect(first.domNode?.textContent).toBe('[!TIP]\n中文 body');
        first.text = '[!CAUTION]\nchanged';
        first.update();
        expect(root.querySelector('.markdown-alert-caution')).not.toBeNull();
        first.text = 'ordinary';
        first.update();
        expect(root.querySelector('.mu-github-alert')).toBeNull();
        muya.destroy();
    });

    it('validates color swatches without accepting CSS payloads', () => {
        expect(renderToStaticHTML('`#0969DA` `rgb(9, 105, 218)` `hsl(212, 92%, 45%)`')).toMatch(/github-color-swatch/);
        expect(renderToStaticHTML('`rgb(999,0,0)` `red;url(javascript:alert(1))`')).not.toContain('github-color-swatch');
    });

    it('links explicit github references without changing escaped text, emails or code', () => {
        const html = renderToStaticHTML('@DwenChen @github/docs DwenChen/marktext#12\n\n`@DwenChen` \\@DwenChen user@example.com [@DwenChen](https://example.com)');
        expect(html).toContain('href="https://github.com/DwenChen"');
        expect(html).toContain('href="https://github.com/orgs/github/teams/docs"');
        expect(html).toContain('href="https://github.com/DwenChen/marktext/issues/12"');
        expect(html).toContain('<code>@DwenChen</code>');
        expect(html).toContain('mailto:user@example.com');
        expect(html).toContain('<a href="https://example.com">@DwenChen</a>');
    });

    it('keeps github heading spacing and duplicate suffixes', async () => {
        const html = await new MarkdownToHtml('# A  B\n\n# A  B\n\n# A--B').renderHtml();
        expect(html).toContain('id="a--b"');
        expect(html).toContain('id="a--b-1"');
        expect(html).toContain('id="a--b-2"');
    });

    it('renders one and two tilde strikethrough in github mode', () => {
        window.MUYA_VERSION = 'test';
        const muya = new Muya(document.createElement('div'), { markdown: '~old~ and ~~older~~', superSubScript: false });
        muya.init();
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        first.update();
        expect(muya.domNode.querySelectorAll('del')).toHaveLength(2);
        expect(renderToStaticHTML('~old~ and ~~older~~', { superSubScript: false })).toContain('<del>old</del>');
        muya.destroy();
    });

    it.each([['geojson', GEOJSON], ['topojson', TOPOJSON], ['stl', STL]])('previews and exports %s and preserves its fence', async (type, source) => {
        const markdown = `\`\`\`${type}\n${source}\n\`\`\``;
        const state = new MarkdownToState().generate(markdown);
        expect(state[0].name).toBe('diagram');
        expect(new ExportMarkdown().generate(state).trim()).toBe(markdown);
        const html = await new MarkdownToHtml(markdown).generate();
        expect(html).toContain('<svg');
        expect(html).toContain(`class="${type} github-geometry"`);
        expect(html).not.toContain('src="https://');
    });

    it('keeps polygon holes in the same evenodd path', () => {
        const target = document.createElement('div');
        renderGithubGeometry('geojson', GEOJSON, target);
        expect(target.querySelector('[fill-rule="evenodd"]')?.getAttribute('d')?.match(/Z/g)).toHaveLength(2);
    });

    it('keeps geometry gestures in the preview instead of activating source editing', () => {
        const target = document.createElement('div');
        let clicks = 0;
        target.addEventListener('click', () => clicks++);
        renderGithubGeometry('stl', STL, target);
        const svg = target.querySelector('svg')!;
        svg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(clicks).toBe(0);
        expect(target.querySelector('polygon')?.getAttribute('fill')).toBe('none');
    });

    it('rejects invalid geometry and safely preserves invalid export source', async () => {
        const target = document.createElement('div');
        expect(() => renderGithubGeometry('geojson', '{"type":"Point","coordinates":[null,1]}', target)).toThrow();
        expect(() => renderGithubGeometry('topojson', '{"type":"Topology","arcs":[],"objects":{"a":{"type":"LineString","arcs":[9]}}}', target)).toThrow();
        expect(() => renderGithubGeometry('stl', 'solid empty\nendsolid empty', target)).toThrow();
        const html = await new MarkdownToHtml('```geojson\n<script>bad()</script>\n```').renderHtml();
        expect(html).toContain('Invalid geojson diagram');
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>');
    });
});
