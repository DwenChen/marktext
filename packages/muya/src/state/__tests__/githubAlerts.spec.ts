// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { getTextContent } from '../../selection/dom';
import { GITHUB_ALERTS } from '../../utils/githubAlerts';
import { getClipBoardHtml } from '../../utils/marked';
import HtmlToMarkdown from '../htmlToMarkdown';
import { MarkdownToHtml } from '../markdownToHtml';
import { renderToStaticHTML } from '../renderToStaticHTML';

vi.mock('../../utils/diagram', () => ({ default: vi.fn() }));

const editors: Muya[] = [];

afterEach(() => {
    for (const editor of editors.splice(0)) {
        editor.destroy();
        editor.domNode.remove();
    }
});

function boot(markdown: string) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = new Muya(host, { markdown });
    editor.init();
    editors.push(editor);
    return editor;
}

function htmlRoot(html: string) {
    const root = document.createElement('div');
    root.innerHTML = html;
    return root;
}

describe('gitHub alerts', () => {
    it.each(Object.entries(GITHUB_ALERTS))('renders %s with its GitHub title and SVG icon', (type, alert) => {
        const root = htmlRoot(renderToStaticHTML(`> [!${type}]\n> Body with **bold** and [link](https://github.com).`));
        const element = root.querySelector(`.markdown-alert-${type.toLowerCase()}`)!;
        expect(element.querySelector('.markdown-alert-title')?.textContent).toBe(alert.title);
        expect(element.querySelector('svg path')?.getAttribute('d')).toBe(alert.path);
        expect(element.querySelector('strong')?.textContent).toBe('bold');
        expect(element.querySelector('a')?.getAttribute('href')).toBe('https://github.com');
        expect(element.textContent).not.toContain(`[!${type}]`);
    });

    it.each(['> [!note]\n> body', '> [!TIP]  \n> body', '> [!IMPORTANT]\n>\n> body', '> [!CAUTION]'])('accepts GitHub marker variants: %s', (source) => {
        expect(renderToStaticHTML(source)).toContain('class="markdown-alert markdown-alert-');
    });

    it.each([
        '> Ordinary quotation',
        '> [!UNKNOWN]\n> body',
        '> [!NOTE] same line',
        '> \\[!NOTE]\n> body',
        '> `[!NOTE]`\n> body',
        '> Intro\n>\n> [!NOTE]\n> body',
        '> Outer\n>\n> > [!TIP]\n> > nested',
        '- Item\n  > [!WARNING]\n  > nested',
        '<details>\n<summary>Details</summary>\n\n> [!TIP]\n> nested\n\n</details>',
        '```md\n> [!NOTE]\n> example\n```',
    ])('keeps non-alert syntax unchanged: %s', (source) => {
        expect(renderToStaticHTML(source)).not.toContain('class="markdown-alert markdown-alert-');
    });

    it('preserves body references, lists, code, and hard breaks after the title', () => {
        const root = htmlRoot(renderToStaticHTML('> [!NOTE]  \n> [reference][docs]\n>\n> - Item\n>\n> ```js\n> const a = 1\n> ```\n\n[docs]: https://github.com'));
        expect(root.querySelector('a')?.getAttribute('href')).toBe('https://github.com');
        expect(root.querySelector('li')?.textContent).toBe('Item');
        expect(root.querySelector('code')?.textContent).toContain('const a = 1');
        expect(root.querySelector('.markdown-alert > p:nth-child(2)')?.innerHTML).not.toMatch(/^<br/);
    });

    it('uses the same alert shape in clipboard and styled HTML export', async () => {
        const markdown = '> [!WARNING]\n> Export me';
        expect(getClipBoardHtml(markdown)).toContain('markdown-alert-warning');
        const exported = await new MarkdownToHtml(markdown).generate();
        expect(exported).toContain('markdown-alert-warning');
        expect(exported).toContain('.markdown-alert-title .octicon');
    });

    it('retains Markdown syntax and source offsets while displaying editable markers', () => {
        const markdown = '> [!NOTE]\n> Body **bold**\n';
        const editor = boot(markdown);
        const content = editor.domNode.querySelector('.mu-paragraph-content')!;
        const marker = content.querySelector('.mu-alert-marker')!;
        expect(marker.getAttribute('data-title')).toBe('Note');
        expect(marker.textContent).toBe('[!NOTE]');
        expect(getTextContent(content)).toBe('[!NOTE]\nBody **bold**');
        expect(editor.getMarkdown()).toBe(markdown);
    });

    it('updates alert markers after typing and source replacement', () => {
        const editor = boot('> [!NOTE]\n> Body\n');
        const quote = editor.editor.scrollPage!.firstChild!;
        if (!quote.isParent())
            throw new Error('Expected a blockquote container');
        const content = quote.firstContentInDescendant()!;
        content.text = '[!TIP]\nBody';
        content.update();
        expect(editor.domNode.querySelector('.mu-alert-marker')?.getAttribute('data-alert')).toBe('TIP');
        editor.setContent('> [!UNKNOWN]\n> Body\n');
        expect(editor.domNode.querySelector('.mu-alert-marker')).toBeNull();
        editor.setContent('> [!CAUTION]\n> Body\n');
        expect(editor.domNode.querySelector('.mu-alert-marker')?.getAttribute('data-alert')).toBe('CAUTION');
    });

    it('imports copied alert HTML back to its Markdown marker', () => {
        const html = renderToStaticHTML('> [!IMPORTANT]\n> **Body**');
        const markdown = new HtmlToMarkdown().generate(html);
        expect(markdown).toContain('> [!IMPORTANT]');
        expect(markdown).toContain('> **Body**');
    });
});
