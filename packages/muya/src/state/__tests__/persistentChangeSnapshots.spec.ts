// @vitest-environment happy-dom
import type { JSONOp } from 'ot-json1';
import type Content from '../../block/base/content';
import type { TState } from '../types';
import * as json1 from 'ot-json1';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asDoc } from '..';
import { Muya } from '../../muya';
import { deepClone } from '../../utils';

vi.mock('../../utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils')>();
    return { ...actual, deepClone: vi.fn(actual.deepClone) };
});

interface IChange {
    op: JSONOp;
    source: string;
    prevDoc: TState[];
    doc: TState[];
}

let muya: Muya;
beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'alpha\n\nsecond' });
    muya.init();
});

afterEach(() => {
    muya.destroy();
    muya.domNode.remove();
    vi.restoreAllMocks();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function edit(text: string) {
    const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;
    leaf.text = text;
    leaf.update();
    muya.flush();
}

describe('persistent state snapshots', () => {
    it('records text history without copying either full document', () => {
        const before = muya.editor.jsonState.getReadonlyState();
        vi.mocked(deepClone).mockClear();
        edit('alpha!');
        const after = muya.editor.jsonState.getReadonlyState();
        expect(vi.mocked(deepClone).mock.calls.every(([value]) => value !== before && value !== after)).toBe(true);
        expect(after[1]).toBe(before[1]);
        expect(before[0]).toMatchObject({ text: 'alpha' });
        expect(muya.editor.history.canUndo()).toBe(true);
        vi.mocked(deepClone).mockClear();
        muya.undo();
        expect(vi.mocked(deepClone).mock.calls.every(([value]) => value !== after)).toBe(true);
        expect(muya.getMarkdown().trim()).toBe('alpha\n\nsecond');
        muya.redo();
        expect(muya.getMarkdown().trim()).toBe('alpha!\n\nsecond');
    });

    it('copies public snapshots only on demand and keeps each event revision', () => {
        const changes: IChange[] = [];
        muya.on('json-change', (change: IChange) => changes.push(change));
        edit('one');
        edit('two');
        muya.setContent('another document');
        vi.mocked(deepClone).mockClear();
        expect(changes[0].prevDoc[0]).toMatchObject({ text: 'alpha' });
        expect(changes[0].doc[0]).toMatchObject({ text: 'one' });
        expect(changes[1].prevDoc[0]).toMatchObject({ text: 'one' });
        expect(changes[1].doc[0]).toMatchObject({ text: 'two' });
        expect(deepClone).toHaveBeenCalledTimes(4);
        expect(changes[0].doc).toBe(changes[0].doc);
        expect(deepClone).toHaveBeenCalledTimes(4);
        changes[0].doc.splice(0, 2);
        changes[1].prevDoc.splice(0, 2);
        expect(muya.getMarkdown().trim()).toBe('another document');
    });

    it('keeps public before and after copies independent even for unchanged nodes', () => {
        let change: IChange | undefined;
        muya.on('json-change', (event: IChange) => {
            change = event;
        });
        edit('alpha!');
        expect(change!.doc[1]).not.toBe(change!.prevDoc[1]);
        if (change!.doc[1].name === 'paragraph')
            change!.doc[1].text = 'changed publicly';
        expect(change!.prevDoc[1]).toMatchObject({ text: 'second' });
        expect(muya.getMarkdown().trim()).toBe('alpha!\n\nsecond');
        muya.undo();
        expect(muya.getMarkdown().trim()).toBe('alpha\n\nsecond');
    });

    it('captures direct dispatch snapshots before a public listener makes a nested edit', () => {
        const changes: IChange[] = [];
        muya.on('json-change', (change: IChange) => {
            changes.push(change);
            if (changes.length === 1) {
                expect(muya.editor.history.canUndo()).toBe(true);
                muya.editor.jsonState.dispatch(json1.editOp([0, 'text'], 'text-unicode', [6, '?']), 'user');
            }
        });
        muya.editor.jsonState.dispatch(json1.editOp([0, 'text'], 'text-unicode', [5, '!']), 'user');
        expect(changes[0].prevDoc[0]).toMatchObject({ text: 'alpha' });
        expect(changes[0].doc[0]).toMatchObject({ text: 'alpha!' });
        expect(changes[1].prevDoc[0]).toMatchObject({ text: 'alpha!' });
        expect(changes[1].doc[0]).toMatchObject({ text: 'alpha!?' });
    });

    it('isolates inserted operation metadata from the live block tree and retained snapshots', () => {
        const inserted: TState = { name: 'code-block', meta: { type: 'fenced', lang: '' }, text: 'body' };
        const operation = json1.insertOp([2], asDoc(inserted));
        let change: IChange | undefined;
        muya.on('json-change', (event: IChange) => {
            change ??= event;
        });
        muya.editor.updateContents(operation, null, 'user');
        inserted.meta.lang = 'changed externally';
        const block = muya.editor.scrollPage!.lastChild;
        if (block?.blockName === 'code-block' && 'meta' in block)
            (block.meta as { lang: string }).lang = 'changed by block';
        expect(change!.doc[2]).toMatchObject({ meta: { lang: '' } });
        expect(muya.getState()[2]).toMatchObject({ meta: { lang: '' } });
        muya.undo();
        muya.redo();
        expect(muya.getState()[2]).toMatchObject({ meta: { lang: '' } });
    });

    it('takes ownership of externally supplied state arrays and metadata', () => {
        const supplied: TState[] = [{ name: 'atx-heading', text: '# original', meta: { level: 1 } }];
        muya.setContent(supplied);
        const snapshot = muya.editor.jsonState.getReadonlyState();
        if (supplied[0].name === 'atx-heading')
            supplied[0].meta.level = 5;
        supplied.length = 0;
        expect(snapshot[0]).toMatchObject({ name: 'atx-heading', meta: { level: 1 } });
        expect(muya.getState()).toEqual(snapshot);
    });
});
