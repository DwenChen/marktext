// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

const editors: Muya[] = [];

function boot(markdown: string, text: string) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    editors.push(muya);
    placeCaret(muya, text);
    return muya;
}

function placeCaret(muya: Muya, text: string) {
    let content = muya.editor.scrollPage!.firstContentInDescendant();
    while (content && content.text !== text)
        content = content.nextContentInContext();
    if (!content)
        throw new Error(`Missing content: ${text}`);
    content.setCursor(content.text.length, content.text.length, true);
    return content;
}

function typeText(muya: Muya, text: string) {
    const content = muya.getSelection()!.focus.block;
    content.text += text;
    muya.flush();
}

afterEach(() => {
    for (const muya of editors.splice(0))
        muya.destroy();
});

describe('typing in existing adjacent levels', () => {
    it('continues the parent list after the complete containing item, with one undo step', () => {
        const muya = boot('- parent\n  - child\n    - deeper\n  - child sibling\n- sibling', 'child');
        const before = muya.getState();
        expect(muya.getTypingLevels()).toEqual(['previous', 'next']);
        muya.typeAtLevel('previous');
        const state = muya.getState();
        expect(state[0]).toMatchObject({ name: 'bullet-list', children: [
            expect.objectContaining({ children: before[0].name === 'bullet-list' ? before[0].children[0].children : [] }),
            { name: 'list-item', children: [{ name: 'paragraph', text: '' }] },
            { name: 'list-item', children: [{ name: 'paragraph', text: 'sibling' }] },
        ] });
        expect(muya.getSelection()!.focus.path).toEqual([0, 'children', 1, 'children', 0, 'text']);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(state);
        typeText(muya, 'new parent');
        const saved = muya.getMarkdown();
        muya.setContent(saved);
        expect(muya.getMarkdown()).toContain('- new parent\n- sibling');
    });

    it.each([
        ['3. parent\n   - child\n4. sibling', '4. new parent\n5. sibling'],
        ['- [x] parent\n  - child\n- [x] sibling', '- [ ] new parent\n- [x] sibling'],
        ['3. [x] parent\n   - child\n4. [x] sibling', '4. [ ] new parent\n5. [x] sibling'],
    ])('continues ordered/task parent metadata: %s', (markdown, expected) => {
        const muya = boot(markdown, 'child');
        muya.typeAtLevel('previous');
        typeText(muya, 'new parent');
        expect(muya.getMarkdown()).toContain(expected);
        expect(muya.getMarkdown()).toContain('child');
    });

    it.each(['- child', '1. child', '- [x] child'])('continues an existing child list: %s', (child) => {
        const muya = boot(`- parent\n  ${child}\n- sibling`, 'parent');
        const before = muya.getState();
        muya.typeAtLevel('next');
        typeText(muya, 'new child');
        expect(muya.getMarkdown()).toContain('parent');
        expect(muya.getMarkdown()).toContain('child');
        expect(muya.getMarkdown()).toContain('new child');
        expect(muya.getMarkdown()).toContain('sibling');
        const root = muya.getState()[0];
        if (root.name !== 'bullet-list')
            throw new Error('Expected list');
        expect(root.children).toHaveLength(2);
        const nested = root.children[0].children[1];
        expect(nested).toMatchObject({ children: [expect.anything(), expect.objectContaining({
            children: [{ name: 'paragraph', text: 'new child' }],
        })] });
        expect(before[0].name).toBe('bullet-list');
    });

    it('reuses an empty input on either level without adding an undo entry', () => {
        const muya = boot('- parent\n  - child\n  - \n- ', 'parent');
        const before = muya.getState();
        muya.typeAtLevel('next');
        expect(muya.getState()).toEqual(before);
        expect(muya.getSelection()!.focus.block.text).toBe('');
        muya.typeAtLevel('previous');
        expect(muya.getState()).toEqual(before);
        expect(muya.getSelection()!.focus.path).toEqual([0, 'children', 1, 'children', 0, 'text']);
    });

    it('moves exactly one level through mixed quotes and lists', () => {
        const muya = boot('> outer\n>\n> - parent\n>   - child\n> - sibling\n>\n> tail', 'child');
        muya.typeAtLevel('previous');
        typeText(muya, 'new list item');
        expect(muya.getMarkdown()).toContain('> - new list item');
        placeCaret(muya, 'new list item');
        muya.typeAtLevel('previous');
        typeText(muya, 'new quote paragraph');
        expect(muya.getMarkdown()).toContain('> new quote paragraph');
        expect(muya.getMarkdown()).toContain('> tail');
    });

    it('continues at the root after a top-level list or quote', () => {
        const muya = boot('- parent\n  - child\n\nafter', 'parent');
        muya.typeAtLevel('previous');
        typeText(muya, 'root text');
        expect(muya.getState().map(block => block.name)).toEqual(['bullet-list', 'paragraph', 'paragraph']);
        expect(muya.getMarkdown()).toContain('root text\n\nafter');
        expect(muya.getTypingLevels()).toEqual([]);
    });

    it.each([
        ['- parent\n\n  > quoted', 'quoted'],
        ['- parent\n\n  ```\n  code\n  ```', 'code'],
        ['- parent\n\n  $$\n  x^2\n  $$', 'x^2'],
        ['- parent\n\n  | A |\n  | --- |\n  | B |', 'B'],
    ])('enters an existing child block: %s', (markdown, text) => {
        const muya = boot(markdown, 'parent');
        const before = muya.getState();
        expect(muya.getTypingLevels()).toEqual(['previous', 'next']);
        muya.typeAtLevel('next');
        if (text !== 'quoted')
            expect(muya.getState()).toEqual(before);
        expect(muya.getSelection()!.focus.block.text).toBe(text === 'quoted' ? '' : text);
        muya.typeAtLevel('previous');
        typeText(muya, 'next parent');
        expect(muya.getMarkdown()).toContain('- next parent');
        expect(muya.getMarkdown()).toContain(text);
    });

    it('chooses the next child block before considering earlier children', () => {
        const muya = boot('- parent\n\n  > earlier\n\n  middle\n\n  1. later', 'middle');
        muya.typeAtLevel('next');
        expect(muya.getSelection()!.focus.block.getAncestors().some(block => block.blockName === 'order-list')).toBe(true);
    });

    it('hides absent levels and ignores ranges, stale directions, and invalid requests', () => {
        const muya = boot('root\n\n- parent\n- sibling', 'root');
        expect(muya.getTypingLevels()).toEqual([]);
        const before = muya.getState();
        muya.typeAtLevel('previous');
        muya.typeAtLevel('next');
        expect(muya.getState()).toEqual(before);
        const parent = placeCaret(muya, 'parent');
        expect(muya.getTypingLevels()).toEqual(['previous']);
        muya.typeAtLevel('next');
        parent.setCursor(0, 3, true);
        expect(muya.getTypingLevels()).toEqual([]);
        muya.typeAtLevel('previous');
        expect(muya.getState()).toEqual(before);
    });
});
