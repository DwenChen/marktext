// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyType } from '../clipboard/types';
import { Muya } from '../muya';

const editors: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    for (const editor of editors.splice(0)) {
        editor.destroy();
        editor.domNode.remove();
    }
    vi.restoreAllMocks();
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const editor = new Muya(host, { markdown });
    editor.init();
    editors.push(editor);
    return editor;
}

describe('copy paragraph selection', () => {
    it('copies the live caret paragraph before the cached selection catches up', () => {
        const muya = boot('first\n\nsecond\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const second = muya.editor.scrollPage!.lastContentInDescendant()!;
        first.setCursor(0, 0, true);
        const range = document.createRange();
        range.selectNodeContents(second.domNode);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        expect(muya.editor.activeContentBlock).toBe(first);
        const copy = vi.spyOn(muya.editor.clipboard, 'copy').mockImplementation(() => {});

        muya.copyParagraph();

        expect(copy).toHaveBeenCalledWith(CopyType.COPY_CODE_CONTENT, 'second\n');
        expect(muya.getMarkdown()).toBe('first\n\nsecond\n');
    });

    it('keeps the cached paragraph when the native selection belongs to another editor', () => {
        const muya = boot('first\n');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
        const other = boot('other\n');
        other.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
        const copy = vi.spyOn(muya.editor.clipboard, 'copy').mockImplementation(() => {});

        muya.copyParagraph();

        expect(copy).toHaveBeenCalledWith(CopyType.COPY_CODE_CONTENT, 'first\n');
    });
});
