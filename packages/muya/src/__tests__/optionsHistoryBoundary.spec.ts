// @vitest-environment happy-dom
import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

let muya: Muya;
beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'alpha', footnote: false });
    muya.init();
});
afterEach(() => {
    muya.destroy();
    muya.domNode.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function edit(text: string) {
    const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;
    leaf.text = text;
    leaf.update();
}

describe('option and history boundaries', () => {
    it.each([{ superSubScript: true }, { footnote: true }])('commits queued text before rendering %j', (options) => {
        edit('alpha!');
        muya.setOptions(options, true);
        expect(muya.getMarkdown().trim()).toBe('alpha!');
        expect(muya.domNode.textContent).toContain('alpha!');
        muya.undo();
        expect(muya.getMarkdown().trim()).toBe('alpha');
    });

    it('can undo the parser boundary, then the preceding text edit, and redo both', () => {
        muya.setContent('[^f]: note');
        edit('[^f]: note!');
        muya.setOptions({ footnote: true }, true);
        expect(muya.getState()[0].name).toBe('footnote');
        muya.undo();
        expect(muya.getState()[0].name).toBe('paragraph');
        expect(muya.getMarkdown().trim()).toBe('[^f]: note!');
        muya.undo();
        expect(muya.getMarkdown().trim()).toBe('[^f]: note');
        muya.redo();
        muya.redo();
        expect(muya.getState()[0].name).toBe('footnote');
        expect(muya.getMarkdown().trim()).toBe('[^f]: note!');
    });

    it('publishes matching Markdown and TOC during replacement, undo and redo', () => {
        muya.setContent('# Before');
        const snapshots: Array<{ markdown: string; heading: string }> = [];
        muya.on('json-change', () => snapshots.push({
            markdown: muya.getMarkdown().trim(),
            heading: muya.getTOC()[0].content,
        }));
        muya.replaceContent('# After');
        muya.undo();
        muya.redo();
        expect(snapshots).toEqual([
            { markdown: '# After', heading: 'After' },
            { markdown: '# Before', heading: 'Before' },
            { markdown: '# After', heading: 'After' },
        ]);
    });

    it('retains the document and both history stacks when replay fails', () => {
        muya.replaceContent('beta');
        const before = muya.getHistory();
        const failing = vi.spyOn(muya.editor, 'rebuildContents').mockImplementationOnce(() => {
            throw new Error('replay failed');
        });
        expect(() => muya.undo()).toThrow('replay failed');
        expect(muya.getMarkdown().trim()).toBe('beta');
        expect(muya.getHistory().stack).toEqual(before.stack);
        failing.mockRestore();
        muya.undo();
        expect(muya.getMarkdown().trim()).toBe('alpha');
    });
});
