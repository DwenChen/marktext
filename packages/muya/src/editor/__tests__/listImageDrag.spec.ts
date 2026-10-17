// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { getImageInfo } from '../../utils/image';
import { getTextDropTarget, moveDraggedText } from '../dragDropText';
import { standaloneTargetAtPoint } from '../standaloneTextDrop';
import { TextDropIndicator } from '../textDropIndicator';

const editors: Muya[] = [];

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

function move(muya: Muya, text: string, destination: string, options = { copy: false, after: true, start: 0, end: text.length, offset: destination.length }, standalone = true) {
    const source = leaf(muya, text);
    source.setCursor(options.start, options.end, true);
    const selection = muya.getSelection()!;
    const target = leaf(muya, destination);
    return moveDraggedText(muya, selection, { block: target, path: target.path, offset: options.offset }, options.copy, options.after, standalone ? target.parent!.parent! : undefined);
}

afterEach(() => {
    for (const muya of editors.splice(0))
        muya.destroy();
});

describe('list images and managed text drags', () => {
    it.each(['source', '- source\n  - child', '3. source\n   - child', '- [x] source\n  - child'])('inserts an entire selected line at a text caret for move and copy: %s', (markdown) => {
        for (const copy of [false, true]) {
            const muya = boot(`${markdown}\n\n- [ ] target word`);
            const source = leaf(muya, 'source');
            source.setCursor(0, source.text.length, true);
            const selection = muya.getSelection()!;
            const target = leaf(muya, 'target word');
            const endpoint = { block: target, path: target.path, offset: 6 };
            expect(getTextDropTarget(muya, selection, endpoint, false)?.standalone).toBeUndefined();
            const before = muya.getState();
            const itemCount = muya.domNode.querySelectorAll('li').length;
            expect(moveDraggedText(muya, selection, endpoint, copy, false)).toBe(true);
            expect(leaf(muya, 'targetsource word').text).toBe('targetsource word');
            expect(muya.domNode.querySelectorAll('li')).toHaveLength(itemCount - Number(!copy && markdown !== 'source'));
            expect(Array.from(muya.domNode.querySelectorAll('.mu-paragraph-content')).every(element => element.textContent!.trim())).toBe(true);
            expect(muya.getMarkdown().match(/child/g)?.length ?? 0).toBe(markdown.includes('child') ? 1 : 0);
            if (copy)
                expect(leaf(muya, 'source').text).toBe('source');
            const moved = muya.getState();
            muya.undo();
            expect(muya.getState()).toEqual(before);
            muya.redo();
            expect(muya.getState()).toEqual(moved);
        }
    });

    it.each([
        '- source\n- target word',
        '3. source\n4. target word',
        '- [x] source\n- [ ] target word',
        '- parent\n  - source\n- target word',
        '- before\n- source\n  - [x] child\n- target word',
        '3. source\n   - child\n4. target word',
    ])('removes the vacated list marker and preserves remaining blocks: %s', (markdown) => {
        const muya = boot(markdown);
        const before = muya.getState();
        expect(move(muya, 'source', 'target word', { copy: false, after: true, start: 0, end: 6, offset: 6 }, false)).toBe(true);
        expect(leaf(muya, 'targetsource word').text).toBe('targetsource word');
        expect(Array.from(muya.domNode.querySelectorAll('.mu-paragraph-content')).every(element => element.textContent!.trim())).toBe(true);
        if (markdown.includes('[x] child'))
            expect(muya.getMarkdown()).toContain('[x] child');
        const moved = muya.getState();
        const result = muya.getMarkdown();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(moved);
        muya.setContent(result);
        expect(muya.getMarkdown()).toBe(result);
        expect(Array.from(muya.domNode.querySelectorAll('.mu-paragraph-content')).every(element => element.textContent!.trim())).toBe(true);
    });

    it('keeps other paragraphs in the source item and leaves unrelated empty items untouched', () => {
        const muya = boot('- \n- source\n\n  more\n- target word');
        expect(move(muya, 'source', 'target word', { copy: false, after: true, start: 0, end: 6, offset: 6 }, false)).toBe(true);
        expect(muya.domNode.querySelectorAll('li')).toHaveLength(3);
        expect(Array.from(muya.domNode.querySelectorAll('.mu-paragraph-content')).map(element => element.textContent!.trim())).toEqual(['', 'more', 'targetsource word']);
    });

    it('keeps a vacated quote structurally valid when its whole paragraph is moved inline', () => {
        const muya = boot('> source\n\n- target word');
        expect(move(muya, 'source', 'target word', { copy: false, after: true, start: 0, end: 6, offset: 6 }, false)).toBe(true);
        expect(muya.getState()[0]).toEqual({ name: 'block-quote', children: [{ name: 'paragraph', text: '' }] });
        expect(leaf(muya, 'targetsource word').text).toBe('targetsource word');
    });

    it.each(['- target\n  - nested\n- sibling', '3. target\n   - nested\n4. sibling', '- [x] target\n  - nested\n- [x] sibling'])('inserts selected words as a separate item at the target list level: %s', (list) => {
        const muya = boot(`keep MOVE tail\n\n${list}`);
        const source = leaf(muya, 'keep MOVE tail');
        source.setCursor(5, 9, true);
        const selection = muya.getSelection()!;
        const target = leaf(muya, 'target');
        const anchor = target.parent!.parent!;
        const before = muya.getState();
        expect(moveDraggedText(muya, selection, { block: target, path: target.path, offset: 0 }, false, true, anchor)).toBe(true);
        expect(leaf(muya, 'keep  tail').text).toBe('keep  tail');
        const root = muya.getState()[1];
        expect(root).toMatchObject({ children: [
            expect.objectContaining({ children: [{ name: 'paragraph', text: 'target' }, expect.objectContaining({ children: expect.any(Array) })] }),
            expect.objectContaining({ children: [{ name: 'paragraph', text: 'MOVE' }] }),
            expect.objectContaining({ children: [{ name: 'paragraph', text: 'sibling' }] }),
        ] });
        if (root.name === 'task-list')
            expect(root.children[1].meta.checked).toBe(false);
        const moved = muya.getState();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(moved);
        const markdown = muya.getMarkdown();
        muya.setContent(markdown);
        expect(muya.getMarkdown()).toBe(markdown);
    });

    it('creates a separate paragraph from a partial selection without merging target text', () => {
        const muya = boot('keep MOVE tail\n\ntarget');
        const source = leaf(muya, 'keep MOVE tail');
        source.setCursor(5, 9, true);
        const target = leaf(muya, 'target');
        expect(moveDraggedText(muya, muya.getSelection()!, { block: target, path: target.path, offset: 0 }, false, false, target.parent!)).toBe(true);
        expect(muya.getState()).toEqual([
            { name: 'paragraph', text: 'keep  tail' },
            { name: 'paragraph', text: 'MOVE' },
            { name: 'paragraph', text: 'target' },
        ]);
    });

    it('copies a complete paragraph to a nested task list while keeping the original', () => {
        const muya = boot('MOVE\n\n- parent\n  - [x] target\n- sibling');
        const source = leaf(muya, 'MOVE');
        source.setCursor(0, 4, true);
        const target = leaf(muya, 'target');
        expect(moveDraggedText(muya, muya.getSelection()!, { block: target, path: target.path, offset: 0 }, true, false, target.parent!.parent!)).toBe(true);
        expect(muya.getMarkdown()).toContain('MOVE\n\n- parent\n  - [ ] MOVE\n  - [x] target');
    });

    it('moves a whole list entry to an independent paragraph without losing its subtree', () => {
        const muya = boot('- MOVE\n  - descendant\n\ntarget');
        const source = leaf(muya, 'MOVE');
        source.setCursor(0, 4, true);
        const target = leaf(muya, 'target');
        expect(moveDraggedText(muya, muya.getSelection()!, { block: target, path: target.path, offset: 0 }, false, false, target.parent!)).toBe(true);
        expect(muya.getMarkdown()).toBe('MOVE\n\n- descendant\n\ntarget\n');
    });

    it('uses paragraph edges and list indentation to choose a standalone destination', () => {
        const muya = boot('- parent\n  - target');
        const target = leaf(muya, 'target');
        const item = target.parent!.parent!;
        const outer = leaf(muya, 'parent').parent!.parent!;
        target.domNode!.getBoundingClientRect = () => new DOMRect(80, 100, 200, 24);
        target.parent!.domNode!.getBoundingClientRect = () => new DOMRect(80, 100, 200, 24);
        item.domNode!.getBoundingClientRect = () => new DOMRect(80, 100, 200, 24);
        outer.domNode!.getBoundingClientRect = () => new DOMRect(40, 76, 240, 48);
        expect(standaloneTargetAtPoint(target, { clientX: 100, clientY: 112 })).toBeUndefined();
        expect(standaloneTargetAtPoint(target, { clientX: 100, clientY: 102 })).toBe(item);
        expect(standaloneTargetAtPoint(target, { clientX: 50, clientY: 112 })).toBe(outer);
    });

    it('previews the same list boundary used by the drop and rejects invalid targets', () => {
        const muya = boot('- parent\n  - source\n    - descendant\n  - target\n- [ ] task');
        const source = leaf(muya, 'source');
        source.setCursor(0, source.text.length, true);
        const selection = muya.getSelection()!;
        const target = leaf(muya, 'target');
        const plan = getTextDropTarget(muya, selection, { block: target, path: target.path, offset: 0 }, true, target.parent!.parent!);
        expect(plan?.after).toBe(true);
        expect(plan?.standalone?.firstContentInDescendant()).toBe(target);
        for (const text of ['source', 'descendant']) {
            const block = leaf(muya, text);
            expect(getTextDropTarget(muya, selection, { block, path: block.path, offset: 0 }, false)).toBeNull();
        }
    });

    it('positions the indicator outside document flow and removes it with its owning editor', () => {
        const muya = boot('source');
        const indicator = new TextDropIndicator(muya.domNode);
        const rect = new DOMRect(40, 80, 200, 24);
        indicator.show(rect, 'item', true);
        const element = muya.domNode.querySelector<HTMLElement>('.mu-text-drop-indicator')!;
        expect(element.style.top).toBe('102.5px');
        expect(element.style.width).toBe('200px');
        expect(element.getAttribute('aria-hidden')).toBe('true');
        expect(muya.getMarkdown()).toBe('source\n');
        indicator.hide();
        expect(element.isConnected).toBe(false);
        indicator.show(rect, 'text');
        expect(element.style.width).toBe('2px');
        expect(element.style.height).toBe('24px');
        element.getBoundingClientRect = () => new DOMRect(100, 50, 2, 2);
        indicator.show(new DOMRect(140, 90, 200, 24), 'text');
        expect(element.style.left).toBe('20px');
        expect(element.style.top).toBe('20px');
        expect(element.style.width).toBe('1px');
        expect(element.style.height).toBe('12px');
        muya.destroy();
        editors.splice(editors.indexOf(muya), 1);
        expect(element.isConnected).toBe(false);
    });

    it('drops an image inside the pointed-to nested list item and can undo the insertion', () => {
        const muya = boot('- parent\n  - child\n- sibling');
        muya.options.getPathForFile = () => '/photo.png';
        const before = muya.getState();
        const transfer = new DataTransfer();
        transfer.items.add(new File(['image'], 'photo.png', { type: 'image/png' }));
        const event = new DragEvent('drop', { bubbles: true, cancelable: true, clientY: 1 });
        Object.defineProperty(event, 'clientY', { value: 1 });
        Object.defineProperty(event, 'dataTransfer', { value: transfer });
        leaf(muya, 'child').domNode!.dispatchEvent(event);
        muya.flush();
        expect(muya.getState()).toMatchObject([{ name: 'bullet-list', children: [
            { children: [{ text: 'parent' }, { name: 'bullet-list', children: [
                { children: [{ text: 'child' }, { text: '![photo.png](/photo.png)' }] },
            ] }] },
            { children: [{ text: 'sibling' }] },
        ] }]);
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it.each(['- ', '3. ', '- [x] ', '3. [x] '])('enter after a selected image continues its list: %s', (marker) => {
        const indent = marker.startsWith('3.') ? '   ' : '  ';
        const muya = boot(`${marker}parent\n\n${indent}![photo](photo.png)`);
        const image = leaf(muya, '![photo](photo.png)');
        image.setCursor(image.text.length, image.text.length, true);
        const before = muya.getState();
        const wrapper = image.domNode!.querySelector<HTMLElement>('.mu-inline-image')!;
        muya.editor.selection.selectImage({ ...getImageInfo(wrapper), block: image as Parameters<typeof muya.editor.selection.selectImage>[0]['block'] });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        muya.flush();
        const state = muya.getState()[0];
        expect(state).toHaveProperty('children');
        if (!('children' in state))
            throw new Error('Expected list');
        expect(state.children).toHaveLength(2);
        expect(muya.getMarkdown()).toContain('![photo](photo.png)');
        expect(muya.getSelection()!.focus.block.text).toBe('');
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()[0]).toEqual(state);
    });

    it('moves a list entry together with all nested children, with one undo boundary', () => {
        const muya = boot('- parent\n  - copied\n    - descendant\n  - target\n- sibling');
        const before = muya.getState();
        expect(move(muya, 'copied', 'target')).toBe(true);
        expect(muya.getMarkdown()).toContain('  - target\n  - copied\n    - descendant');
        const moved = muya.getState();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(moved);
        const markdown = muya.getMarkdown();
        muya.setContent(markdown);
        expect(muya.getMarkdown()).toBe(markdown);
    });

    it('moves the only nested entry out without leaving an empty list', () => {
        const muya = boot('- parent\n  - child\n    - descendant\n- sibling');
        expect(move(muya, 'child', 'sibling')).toBe(true);
        expect(muya.getMarkdown()).toBe('- parent\n- sibling\n- child\n  - descendant\n');
    });

    it('copies a task entry without losing checked state or its subtree', () => {
        const muya = boot('- [x] source\n  - child\n- [ ] target');
        expect(move(muya, 'source', 'target', { copy: true, after: false, start: 0, end: 6, offset: 0 })).toBe(true);
        expect(muya.getMarkdown().match(/\[x\] source/g)).toHaveLength(2);
        expect(muya.getMarkdown().match(/ {2}- child/g)).toHaveLength(2);
    });

    it('keeps a drop into its own descendant unchanged', () => {
        const muya = boot('- parent\n  - child\n- sibling');
        const before = muya.getState();
        expect(move(muya, 'parent', 'child')).toBe(false);
        expect(muya.getState()).toEqual(before);
        expect(muya.editor.history.getHistory().stack.undo).toHaveLength(0);
    });

    it('moves a partial selection within a paragraph and restores it on undo', () => {
        const muya = boot('- abc def ghi');
        const before = muya.getState();
        expect(move(muya, 'abc def ghi', 'abc def ghi', { copy: false, after: true, start: 0, end: 4, offset: 11 }, false)).toBe(true);
        expect(muya.getMarkdown()).toBe('- def ghiabc \n');
        muya.undo();
        expect(muya.getState()).toEqual(before);
    });

    it.each(['deleteByDrag', 'insertFromDrop'])('blocks untracked native DOM mutation: %s', (inputType) => {
        const muya = boot('- parent\n  - child');
        const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType });
        leaf(muya, 'child').domNode!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(muya.getMarkdown()).toBe('- parent\n  - child\n');
    });

    it('rejects cross-block drags before Chromium can remove their content', () => {
        const muya = boot('- parent\n  - child\n- sibling');
        const first = leaf(muya, 'parent');
        const last = leaf(muya, 'child');
        muya.editor.selection.setSelection({ block: first, path: first.path, offset: 0 }, { block: last, path: last.path, offset: 5 });
        const event = new DragEvent('dragstart', { bubbles: true, cancelable: true });
        first.domNode!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(muya.getMarkdown()).toBe('- parent\n  - child\n- sibling\n');
    });
});
