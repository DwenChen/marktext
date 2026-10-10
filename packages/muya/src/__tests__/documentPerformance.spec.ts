// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';
import { MarkdownStateCache } from '../state/markdownStateCache';

let muya: Muya | undefined;
function boot(markdown = '') {
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown });
    muya.init({ focus: false });
    return muya;
}
afterEach(() => {
    muya?.destroy();
    muya = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('document rendering cost and ownership', () => {
    it('uses a constant number of document snapshots when rendering many leaves', () => {
        const editor = boot();
        const snapshots = vi.spyOn(editor.editor.jsonState, 'getState');
        editor.setContent(`${Array.from({ length: 200 }, (_, i) => `Paragraph ${i} [link][ref]\n\n`).join('')}[ref]: https://example.com`);
        editor.getTOC();
        expect(snapshots.mock.calls.length).toBeLessThanOrEqual(3);
        expect(editor.domNode.querySelectorAll('a[href="https://example.com"]')).toHaveLength(200);
    });

    it('refreshes reference definitions after changing documents and applying edits', () => {
        const editor = boot('[link][ref]\n\n[ref]: https://old.test');
        editor.setContent('[link][ref]\n\n[ref]: https://new.test');
        expect(editor.domNode.querySelector('a')?.getAttribute('href')).toBe('https://new.test');
        const definition = editor.editor.scrollPage!.lastContentInDescendant()!;
        definition.text = '[ref]: https://edited.test';
        editor.flush();
        editor.editor.scrollPage!.firstContentInDescendant()!.update();
        expect(editor.domNode.querySelector('a')?.getAttribute('href')).toBe('https://edited.test');
    });

    it('releases heading and checkbox listeners when replacing a document', () => {
        const editor = boot('empty');
        const initialListeners = editor.eventCenter.events.length;
        for (let i = 0; i < 10; i++) {
            editor.setContent('## heading\n\n- [ ] task');
            editor.setContent('empty');
        }
        expect(editor.eventCenter.events).toHaveLength(initialListeners);
        expect(editor.eventCenter.events.every(({ target }) => target === document || target.isConnected)).toBe(true);
    });

    it('disconnects code block observers on replacement and destruction', async () => {
        const disconnect = vi.fn();
        vi.stubGlobal('ResizeObserver', class {
            observe() {}
            disconnect = disconnect;
        });
        const editor = boot();
        editor.setOptions({ codeBlockLineNumbers: true });
        editor.setContent('```\nfirst\nsecond\n```');
        await new Promise(resolve => requestAnimationFrame(resolve));
        editor.setContent('empty');
        expect(disconnect).toHaveBeenCalled();
        disconnect.mockClear();
        editor.setContent('```\nthird\n```');
        await new Promise(resolve => requestAnimationFrame(resolve));
        editor.destroy();
        muya = undefined;
        expect(disconnect).toHaveBeenCalled();
    });

    it('reuses parsed documents and invalidates them when parser options change', () => {
        const editor = boot('initial');
        const parse = vi.spyOn(editor.editor.jsonState, 'markdownToState');
        editor.setContent('cached');
        editor.setContent('other');
        editor.setContent('cached');
        expect(parse).toHaveBeenCalledTimes(2);
        editor.setOptions({ footnote: !editor.options.footnote });
        editor.setContent('cached');
        expect(parse).toHaveBeenCalledTimes(3);
    });

    it('serializes lists repeatedly without mutating authoritative metadata', () => {
        const editor = boot('3. three\n4. four\n\n- [ ] todo');
        const state = editor.getState();
        const markdown = editor.getMarkdown();
        expect(editor.getMarkdown()).toBe(markdown);
        expect(editor.getState()).toEqual(state);
    });

    it('releases media caches owned by the outgoing document', () => {
        const editor = boot();
        const renderer = editor.editor.inlineRenderer.renderer;
        renderer.loadImageMap.set('old', { id: 'old-image', isSuccess: true });
        renderer.urlMap.set('old', 'data:image/png;base64,AAAA');
        renderer.loadMathMap.set('old', 'old formula');
        editor.setContent('next document');
        expect(renderer.loadImageMap.size).toBe(0);
        expect(renderer.urlMap.size).toBe(0);
        expect(renderer.loadMathMap.size).toBe(0);
    });
});

describe('parsed document cache', () => {
    it('does not retain more than the most recently used documents', () => {
        const cache = new MarkdownStateCache(10000, 2);
        const state = [{ name: 'paragraph' as const, text: 'text' }];
        cache.set('one', state);
        cache.set('two', state);
        cache.get('one');
        cache.set('three', state);
        expect(cache.get('two')).toBeUndefined();
        expect(cache.get('one')).toEqual(state);
        expect(cache.get('three')).toEqual(state);
    });

    it('isolates block metadata and skips documents exceeding its memory budget', () => {
        const cache = new MarkdownStateCache(1000);
        cache.set('heading', [{ name: 'atx-heading', text: '# title', meta: { level: 1 } }]);
        const first = cache.get('heading')!;
        if (first[0].name === 'atx-heading')
            first[0].meta.level = 3;
        expect(cache.get('heading')![0]).toMatchObject({ meta: { level: 1 } });
        cache.set('large', [{ name: 'paragraph', text: 'x'.repeat(1000) }]);
        expect(cache.get('large')).toBeUndefined();
        cache.clear();
        expect(cache.get('heading')).toBeUndefined();
    });
});
