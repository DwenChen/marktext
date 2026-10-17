// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { getTextDropTarget, moveDraggedText } from '../dragDropText';
import { imageDragSelection } from '../imageDragSelection';

const editors: Muya[] = [];
const imageText = '![photo](photo.png "caption")';

function boot(markdown: string) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    editors.push(muya);
    return muya;
}

function leaf(muya: Muya, text: string) {
    let block = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && block.text !== text)
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`Missing text: ${text}`);
    return block;
}

function imageSelection(muya: Muya, text = imageText, index = 0) {
    const block = leaf(muya, text);
    const wrapper = block.domNode!.querySelectorAll<HTMLElement>('.mu-inline-image')[index];
    const image = document.createElement('img');
    wrapper.querySelector('.mu-image-container')!.appendChild(image);
    const selection = imageDragSelection(muya, image);
    if (!selection)
        throw new Error('Missing image range');
    return { selection, image, block };
}

afterEach(() => {
    for (const muya of editors.splice(0))
        muya.destroy();
});

describe('managed internal image drag', () => {
    it.each([false, true])('inserts an image token at the caret, copy=%s, including undo and redo', (copy) => {
        const muya = boot(`- ${imageText}\n  - child\n- target word`);
        const before = muya.getState();
        const { selection } = imageSelection(muya);
        const target = leaf(muya, 'target word');
        expect(moveDraggedText(muya, selection, { block: target, path: target.path, offset: 6 }, copy, false, undefined, false)).toBe(true);
        expect(leaf(muya, `target${imageText} word`).text).toBe(`target${imageText} word`);
        expect(muya.getMarkdown().match(/child/g)).toHaveLength(1);
        expect(muya.getMarkdown().match(/!\[photo\]/g)).toHaveLength(copy ? 2 : 1);
        if (!copy)
            expect(muya.getMarkdown()).toBe(`- child\n- target${imageText} word\n`);
        const moved = muya.getState();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(moved);
    });

    it.each([false, true])('creates a standalone list item for only the image, copy=%s', (copy) => {
        const muya = boot(`- ${imageText}\n  - child\n- target`);
        const { selection } = imageSelection(muya);
        const target = leaf(muya, 'target');
        expect(moveDraggedText(muya, selection, { block: target, path: target.path, offset: 0 }, copy, true, target.parent!.parent!, false)).toBe(true);
        expect(muya.getMarkdown().match(/child/g)).toHaveLength(1);
        expect(muya.getMarkdown().match(/!\[photo\]/g)).toHaveLength(copy ? 2 : 1);
        expect(muya.getMarkdown()).toContain(`- target\n- ${imageText}`);
        const state = muya.getState()[0];
        expect(state).toHaveProperty('children');
        if (!('children' in state))
            throw new Error('Missing list');
        expect(state.children.at(-1)).toMatchObject({ children: [{ name: 'paragraph', text: imageText }] });
    });

    it('moves only one of two identical images to another position in the same paragraph', () => {
        const original = `before ${imageText} between ${imageText} after`;
        const muya = boot(original);
        const before = muya.getState();
        const { selection, block } = imageSelection(muya, original, 1);
        expect(selection.anchor.offset).toBe(original.lastIndexOf(imageText));
        expect(moveDraggedText(muya, selection, { block, path: block.path, offset: 0 }, false, false, undefined, false)).toBe(true);
        expect(muya.getState()).toEqual([{ name: 'paragraph', text: `${imageText}before ${imageText} between  after` }]);
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it('allows moving an image into its own child text without moving the parent subtree', () => {
        const muya = boot(`- ${imageText}\n  - child`);
        const { selection } = imageSelection(muya);
        const target = leaf(muya, 'child');
        const endpoint = { block: target, path: target.path, offset: 5 };
        expect(getTextDropTarget(muya, selection, endpoint, false, undefined, false)).not.toBeNull();
        expect(moveDraggedText(muya, selection, endpoint, false, false, undefined, false)).toBe(true);
        expect(muya.getMarkdown()).toBe(`- child${imageText}\n`);
    });

    it('rejects a drop into the original image and cancels without changing the document', () => {
        const muya = boot(`before ${imageText} after`);
        const before = muya.getState();
        const { selection, image, block } = imageSelection(muya, `before ${imageText} after`);
        expect(moveDraggedText(muya, selection, { block, path: block.path, offset: selection.anchor.offset + 1 }, false, false, undefined, false)).toBe(false);
        const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: new DataTransfer() });
        image.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        document.dispatchEvent(new Event('dragend'));
        expect(muya.getState()).toEqual(before);
        expect(muya.domNode.querySelector('.mu-text-drop-indicator')).toBeNull();
    });
});
