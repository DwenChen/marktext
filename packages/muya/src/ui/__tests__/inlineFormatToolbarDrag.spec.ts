// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import Format from '../../block/base/format';
import { Muya } from '../../muya';
import { InlineFormatToolbar } from '../inlineFormatToolbar';

const editors: Muya[] = [];
const tools: InlineFormatToolbar[] = [];

function boot() {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: 'selected words\n\ntarget' } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    editors.push(muya);
    const block = muya.editor.scrollPage!.firstContentInDescendant();
    if (!(block instanceof Format))
        throw new Error('Expected formatted text');
    block.setCursor(0, 8, true);
    const toolbar = new InlineFormatToolbar(muya);
    tools.push(toolbar);
    const show = vi.spyOn(toolbar, 'show').mockImplementation(() => {});
    const request = () => muya.eventCenter.emit('muya-format-picker', { reference: block.domNode!, block });
    return { muya, toolbar, block, show, request };
}

async function nextFrame() {
    await new Promise(resolve => requestAnimationFrame(resolve));
}

afterEach(() => {
    for (const toolbar of tools.splice(0))
        toolbar.destroy();
    for (const muya of editors.splice(0))
        muya.destroy();
    vi.restoreAllMocks();
});

describe('format toolbar during selected text drag', () => {
    it('cancels a queued picker and suppresses later requests during and after a drag', async () => {
        const { muya, request, show } = boot();
        request();
        muya.domNode.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
        request();
        await nextFrame();
        expect(show).not.toHaveBeenCalled();
        document.dispatchEvent(new Event('dragend'));
        request();
        await nextFrame();
        expect(show).not.toHaveBeenCalled();
        muya.domNode.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        request();
        await nextFrame();
        expect(show).toHaveBeenCalledOnce();
    });

    it('hides an existing toolbar and restores normal keyboard selection after dropping', async () => {
        const { muya, toolbar, request, show } = boot();
        toolbar.status = true;
        muya.domNode.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
        expect(toolbar.status).toBe(false);
        muya.domNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control', bubbles: true }));
        request();
        await nextFrame();
        expect(show).not.toHaveBeenCalled();
        document.dispatchEvent(new Event('drop'));
        request();
        await nextFrame();
        expect(show).not.toHaveBeenCalled();
        muya.domNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
        request();
        await nextFrame();
        expect(show).toHaveBeenCalledOnce();
    });

    it('keeps the picker hidden after Escape until a fresh selection gesture', async () => {
        const { muya, request, show } = boot();
        muya.domNode.dispatchEvent(new Event('dragstart', { bubbles: true, cancelable: true }));
        muya.domNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        request();
        await nextFrame();
        expect(show).not.toHaveBeenCalled();
        muya.domNode.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        request();
        await nextFrame();
        expect(show).toHaveBeenCalledOnce();
    });
});
