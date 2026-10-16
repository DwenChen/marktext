import type { TContextBlockType } from '@muyajs/core';
import { expect, test } from '../fixtures/muya';

const types: TContextBlockType[] = ['table', 'code-block', 'block-quote', 'math-block', 'order-list', 'bullet-list'];

for (const type of types) {
    test(`inserts ${type} below the complete paragraph and undoes it`, async ({ page }) => {
        const result = await page.evaluate((type) => {
            const muya = window.muya!;
            muya.setContent('before cursor after\n\nlast');
            muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(7, 7, true);
            muya.applyContextBlock(type);
            const state = muya.getState();
            muya.undo();
            const undo = muya.getMarkdown();
            muya.redo();
            return { state, undo, redo: muya.getState() };
        }, type);
        expect(result.state.map(block => block.name)).toEqual(['paragraph', type, 'paragraph']);
        expect(result.state[0]).toMatchObject({ text: 'before cursor after' });
        expect(result.undo).toBe('before cursor after\n\nlast\n');
        expect(result.redo).toEqual(result.state);
    });

    test(`converts only the backward selection to ${type}`, async ({ page }) => {
        const state = await page.evaluate((type) => {
            const muya = window.muya!;
            muya.setContent('prefix selected suffix');
            const leaf = muya.editor.scrollPage!.firstContentInDescendant()!;
            leaf.setCursor(15, 7, true);
            muya.applyContextBlock(type);
            return muya.getState();
        }, type);
        expect(state.map(block => block.name)).toEqual(['paragraph', type, 'paragraph']);
        expect(state[0]).toMatchObject({ text: 'prefix ' });
        expect(state[2]).toMatchObject({ text: ' suffix' });
        expect(JSON.stringify(state[1])).toContain('selected');
    });
}

test('removes the chosen list layer and preserves deeper mixed list kinds', async ({ page }) => {
    const state = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('- first\n    1. nested\n- last\n\nafter');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        first.nextContentInContext()!.setCursor(2, 2, true);
        muya.applyContextBlock('bullet-list');
        return muya.getState();
    });
    expect(state).toEqual([
        { name: 'paragraph', text: 'first' },
        { name: 'order-list', meta: expect.objectContaining({ start: 1 }), children: [
            expect.objectContaining({ name: 'list-item', children: [{ name: 'paragraph', text: 'nested' }] }),
        ] },
        { name: 'paragraph', text: 'last' }, { name: 'paragraph', text: 'after' },
    ]);
});

test('removes table rendering and preserves every cell', async ({ page }) => {
    const result = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('| A | B |\n| --- | --- |\n| C | D |\n\nafter');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(1, 1, true);
        const active = muya.getActiveContextBlocks();
        muya.applyContextBlock('table');
        return { active, state: muya.getState() };
    });
    expect(result.active).toEqual(['table']);
    expect(result.state).toEqual([
        { name: 'paragraph', text: 'A\tB' }, { name: 'paragraph', text: 'C\tD' },
        { name: 'paragraph', text: 'after' },
    ]);
});

for (const markdown of ['- alpha\n- bravo\n- charlie', '> alpha\n>\n> bravo\n>\n> charlie']) {
    test(`copies both selection directions identically inside ${markdown[0]}`, async ({ page }) => {
        const result = await page.evaluate((markdown) => {
            const muya = window.muya!;
            muya.setContent(markdown);
            const first = muya.editor.scrollPage!.firstContentInDescendant()!;
            const last = muya.editor.scrollPage!.lastContentInDescendant()!;
            const a = { block: first, path: first.path, offset: 2 };
            const f = { block: last, path: last.path, offset: 4 };
            muya.editor.selection.setSelection(a, f);
            const forward = muya.editor.clipboard.getClipboardData().text;
            muya.editor.selection.setSelection(f, a);
            return { forward, backward: muya.editor.clipboard.getClipboardData().text };
        }, markdown);
        expect(result.backward).toBe(result.forward);
        expect(result.backward).toContain('pha');
        expect(result.backward).toContain('bravo');
        expect(result.backward).toContain('char');
    });
}

test('one Select All selects the entire document from a list caret', async ({ page }) => {
    const result = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('first\n\n- middle\n\nlast');
        const middle = muya.editor.scrollPage!.firstContentInDescendant()!.nextContentInContext()!;
        middle.setCursor(2, 2, true);
        muya.selectAll();
        return muya.editor.clipboard.getClipboardData().text;
    });
    expect(result).toBe('first\n\n- middle\n\nlast\n');
});

test('Copy Paragraph writes the whole list and keeps document and selection intact', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const result = await page.evaluate(async () => {
        const muya = window.muya!;
        muya.setContent('- first\n- second\n\nafter');
        const leaf = muya.editor.scrollPage!.firstContentInDescendant()!;
        leaf.setCursor(2, 2, true);
        const before = muya.getMarkdown();
        muya.copyParagraph();
        return {
            before, after: muya.getMarkdown(), clipboard: await navigator.clipboard.readText(),
            offset: muya.getSelection()?.anchor.offset,
        };
    });
    expect(result.after).toBe(result.before);
    expect(result.clipboard).toBe('- first\n- second\n');
    expect(result.offset).toBe(2);
});

test('converts a backward range across list items and keeps both unselected edges', async ({ page }) => {
    const result = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('- alpha\n- bravo\n- charlie\n\nafter');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const last = first.nextContentInContext()!.nextContentInContext()!;
        muya.editor.selection.setSelection(
            { block: last, path: last.path, offset: 4 },
            { block: first, path: first.path, offset: 2 },
        );
        muya.applyContextBlock('code-block');
        const state = muya.getState();
        muya.undo();
        return { state, undo: muya.getMarkdown() };
    });
    expect(result.state.map(block => block.name)).toEqual(['bullet-list', 'code-block', 'bullet-list', 'paragraph']);
    expect(result.state[1]).toMatchObject({ text: 'pha\nbravo\nchar' });
    expect(JSON.stringify(result.state[0])).toContain('al');
    expect(JSON.stringify(result.state[2])).toContain('lie');
    expect(result.undo).toBe('- alpha\n- bravo\n- charlie\n\nafter\n');
});

test('backward copy at an element boundary keeps the entire text', async ({ page }) => {
    const copied = await page.evaluate(() => {
        const muya = window.muya!;
        muya.setContent('a longer paragraph');
        const leaf = muya.editor.scrollPage!.firstContentInDescendant()!;
        const span = leaf.domNode!.querySelector('.mu-plain-text')!;
        document.getSelection()!.setBaseAndExtent(span, span.childNodes.length, span, 0);
        return muya.editor.clipboard.getClipboardData().text;
    });
    expect(copied).toBe('a longer paragraph');
});
