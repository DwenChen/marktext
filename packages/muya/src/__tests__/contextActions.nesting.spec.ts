// @vitest-environment happy-dom

import type { TContextBlockType } from '../block/contextActions';
import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

const editors: Muya[] = [];
const types: TContextBlockType[] = ['table', 'code-block', 'block-quote', 'math-block', 'order-list', 'bullet-list'];

function boot(markdown: string) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    editors.push(muya);
    muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(2, 2, true);
    return muya;
}

afterEach(() => {
    for (const muya of editors.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
});

describe('context block nesting', () => {
    for (const markdown of ['- parent text\n- sibling\n\nafter', '1. parent text\n2. sibling\n\nafter', '- [x] parent text\n- [ ] sibling\n\nafter', '> parent text\n>\n> following\n\nafter']) {
        it.each(types)(`nests %s in ${markdown.split('\n')[0]} with one undo step`, (type) => {
            const muya = boot(markdown);
            const before = muya.getState();
            const beforeMarkdown = muya.getMarkdown();
            expect(muya.getNestableContextBlocks()).toEqual(types);
            muya.nestContextBlock(type);
            const state = muya.getState();
            const root = state[0];
            const previousRoot = before[0];
            if (!('children' in root) || !('children' in previousRoot))
                throw new Error('Expected container');
            const container = root.name === 'block-quote' ? root : root.children[0];
            if (!('children' in container))
                throw new Error('Expected list item');
            expect(container.children[0]).toEqual({ name: 'paragraph', text: 'parent text' });
            expect(container.children[1].name).toBe(type);
            expect(state.slice(1)).toEqual(before.slice(1));
            expect(root.children.slice(root.name === 'block-quote' ? 2 : 1))
                .toEqual(previousRoot.children.slice(1));
            expect(muya.getSelection()?.focus.block.getAncestors().some(block => block.blockName === type)).toBe(true);
            muya.undo();
            expect(muya.getMarkdown()).toBe(beforeMarkdown);
            muya.redo();
            expect(muya.getState()).toEqual(state);
            if (type === 'math-block') {
                const math = container.children[1];
                if (math.name === 'math-block')
                    math.text = 'x^2';
                muya.replaceContent(state);
            }
            const saved = muya.getMarkdown();
            muya.setContent(saved);
            const parsed = muya.getState()[0];
            expect(parsed.name).toBe(root.name);
            if (!('children' in parsed))
                throw new Error('Expected parsed container');
            const parsedContainer = parsed.name === 'block-quote' ? parsed : parsed.children[0];
            if (!('children' in parsedContainer))
                throw new Error('Expected parsed list item');
            expect(parsedContainer.children[0]).toEqual({ name: 'paragraph', text: 'parent text' });
            expect(parsedContainer.children[1].name).toBe(type);
        });
    }

    it('uses the innermost list item in a mixed quote/list tree', () => {
        const muya = boot('> - outer\n>   1. inner\n> - sibling');
        const inner = muya.editor.scrollPage!.firstContentInDescendant()!.nextContentInContext()!;
        inner.setCursor(2, 2, true);
        muya.nestContextBlock('bullet-list');
        expect(muya.getSelection()?.focus.path.filter(part => part === 'children')).toHaveLength(7);
        expect(muya.getMarkdown()).toContain('inner');
        expect(muya.getMarkdown()).toContain('sibling');
    });

    it.each(types)('removes only the newly nested %s format and keeps its parent list', (type) => {
        const muya = boot('- parent text\n- sibling\n\nafter');
        muya.nestContextBlock(type);
        const nested = muya.getState();
        muya.applyContextBlock(type);
        const root = muya.getState()[0];
        if (root.name !== 'bullet-list')
            throw new Error('Expected preserved parent list');
        expect(root.children).toHaveLength(2);
        expect(root.children[0].children.every(block => block.name !== type)).toBe(true);
        expect(root.children[0].children[0]).toEqual({ name: 'paragraph', text: 'parent text' });
        expect(root.children[1].children).toEqual([{ name: 'paragraph', text: 'sibling' }]);
        expect(muya.getSelection()?.focus.path.slice(0, 4)).toEqual([0, 'children', 0, 'children']);
        muya.undo();
        expect(muya.getState()).toEqual(nested);
    });

    it.each([
        { markdown: '- outer\n  - inner\n    - deepest\n- sibling', type: 'bullet-list' as const },
        { markdown: '- outer\n  1. inner\n     - deepest\n- sibling', type: 'order-list' as const },
        { markdown: '> outer\n>\n> > inner\n> >\n> > > deepest', type: 'block-quote' as const },
    ])('unwraps the nearest $type without unwrapping deeper containers', ({ markdown, type }) => {
        const muya = boot(markdown);
        const inner = muya.editor.scrollPage!.firstContentInDescendant()!.nextContentInContext()!;
        inner.setCursor(2, 2, true);
        const before = muya.getState();
        muya.applyContextBlock(type);
        const state = muya.getState();
        const root = state[0];
        const children = root.name === 'block-quote'
            ? root.children
            : root.name === 'bullet-list' ? root.children[0].children : [];
        expect(children.map(child => child.name)).toEqual(['paragraph', 'paragraph', type === 'block-quote' ? 'block-quote' : 'bullet-list']);
        expect(children[1]).toEqual({ name: 'paragraph', text: 'inner' });
        expect(JSON.stringify(children[2])).toContain('deepest');
        expect(muya.getSelection()?.focus.block.text).toBe('inner');
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(state);
    });

    it.each(['plain text', '| a | b |\n| --- | --- |\n| c | d |', '- ```\n  code\n  ```', '> $$\n> x\n> $$'])('rejects nesting in a leaf or at the root: %s', (markdown) => {
        const muya = boot(markdown);
        const before = muya.getState();
        expect(muya.getNestableContextBlocks()).toEqual([]);
        for (const type of types)
            muya.nestContextBlock(type);
        expect(muya.getState()).toEqual(before);
    });

    it('rejects ranges and respects the math parsing preference', () => {
        const muya = boot('- parent text');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(2, 5, true);
        const before = muya.getState();
        muya.nestContextBlock('bullet-list');
        expect(muya.getState()).toEqual(before);
        expect(muya.getNestableContextBlocks()).toEqual([]);
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(2, 2, true);
        muya.setOptions({ texMathDollars: false });
        expect(muya.getNestableContextBlocks()).not.toContain('math-block');
        muya.nestContextBlock('math-block');
        expect(muya.getState()).toEqual(before);
    });
});
