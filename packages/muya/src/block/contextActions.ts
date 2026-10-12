import type { Muya } from '../muya';
import type { IParagraphState, ITableState, TState } from '../state/types';
import type Parent from './base/parent';
import { buildPartialContainerState } from '../clipboard/copyData';
import { SelectionDirection } from '../selection/types';
import { isAnyListState } from '../state/types';

export type TContextBlockType = 'table' | 'code-block' | 'block-quote' | 'math-block' | 'order-list' | 'bullet-list';

const BLOCK_TYPES: TContextBlockType[] = ['table', 'code-block', 'block-quote', 'math-block', 'order-list', 'bullet-list'];

export function getActiveContextBlocks(muya: Muya): TContextBlockType[] {
    const content = muya.getSelection()?.focus.block ?? muya.editor.activeContentBlock;
    const ancestors = content?.getAncestors() ?? [];
    return BLOCK_TYPES.filter(type => ancestors.some(block => block.blockName === type));
}

function paragraphs(text: string): IParagraphState[] {
    return text.split(/\n{2,}/).map(text => ({ name: 'paragraph', text }));
}

function tableFromText(text: string): ITableState {
    const lines = text ? text.split('\n') : ['', '', ''];
    const cells = lines.map(line => line.includes('\t')
        ? line.split('\t')
        : line.includes('|') ? line.replace(/^\s*\||\|\s*$/g, '').split('|').map(cell => cell.trim()) : [line]);
    const columns = Math.max(text ? 1 : 3, ...cells.map(row => row.length));
    while (cells.length < 2)
        cells.push([]);
    return {
        name: 'table',
        children: cells.map(row => ({
            name: 'table.row',
            children: Array.from({ length: columns }, (_, index) => ({
                name: 'table.cell',
                meta: { align: 'none' },
                text: row[index] ?? '',
            })),
        })),
    };
}

function blockFromText(muya: Muya, type: TContextBlockType, text: string): TState {
    switch (type) {
        case 'table':
            return tableFromText(text);
        case 'code-block':
            return { name: type, meta: { type: 'fenced', lang: '', fenceChar: '`' }, text };
        case 'math-block':
            return { name: type, meta: { mathStyle: '' }, text };
        case 'block-quote':
            return { name: type, children: paragraphs(text) };
        case 'order-list':
        case 'bullet-list': {
            const children = text.split(/\n+/).map(text => ({
                name: 'list-item' as const,
                children: [{ name: 'paragraph' as const, text }],
            }));
            const loose = muya.options.preferLooseListItem;
            return type === 'order-list'
                ? { name: type, meta: { start: 1, delimiter: muya.options.orderListDelimiter, loose }, children }
                : { name: type, meta: { marker: muya.options.bulletListMarker, loose }, children };
        }
    }
}

function hasContent(state: TState): boolean {
    return 'text' in state ? state.text.length > 0 : state.children.some(hasContent);
}

function removeBlockFormat(state: TState, type: TContextBlockType): TState[] {
    if (state.name === type) {
        if (state.name === 'table')
            return state.children.map(row => ({ name: 'paragraph', text: row.children.map(cell => cell.text).join('\t') }));
        if ('text' in state)
            return paragraphs(state.text);
        if (state.name === 'block-quote')
            return state.children.flatMap(child => removeBlockFormat(child, type));
        if (state.name === 'order-list' || state.name === 'bullet-list')
            return unwrapLists(state);
    }
    if ('children' in state) {
        // Each concrete container restricts its child type; only quote/list
        // descendants can contain another block of the same kind.
        if (state.name === 'block-quote' || state.name === 'list-item' || state.name === 'task-list-item')
            return [{ ...state, children: state.children.flatMap(child => removeBlockFormat(child, type)) }];
        if (isAnyListState(state)) {
            return [{ ...state, children: state.children.map(item => ({
                ...item,
                children: item.children.flatMap(child => removeBlockFormat(child, type)),
            })) } as TState];
        }
    }
    return [state];
}

function unwrapLists(state: TState): TState[] {
    if (isAnyListState(state))
        return state.children.flatMap(item => item.children.flatMap(unwrapLists));
    if (state.name === 'block-quote')
        return [{ ...state, children: state.children.flatMap(unwrapLists) }];
    return [state];
}

function replaceBlockState(states: TState[], target: Parent, replacement: TState[]): void {
    const indices: number[] = [];
    let node: Parent = target;
    while (!node.isScrollPage && node.parent) {
        indices.unshift(node.parent.offset(node));
        node = node.parent;
    }
    let siblings = states;
    for (const index of indices.slice(0, -1)) {
        const state = siblings[index];
        if (!state || !('children' in state))
            return;
        siblings = state.children;
    }
    siblings.splice(indices.at(-1)!, 1, ...replacement);
}

/** List/table boundaries remain intact outside the range; every action is one undo step. */
export function applyContextBlock(muya: Muya, type: TContextBlockType): void {
    if (!BLOCK_TYPES.includes(type))
        return;
    muya.flush();
    const selection = muya.getSelection();
    const content = selection?.focus.block ?? muya.editor.activeContentBlock;
    const outer = content?.outMostBlock;
    const page = muya.editor.scrollPage;
    if (!content || !outer || !page)
        return;
    const states = muya.getState();
    let focusIndex = page.offset(outer);

    if (selection && !selection.isCollapsed) {
        const [start, end] = selection.direction === SelectionDirection.BACKWARD
            ? [selection.focus, selection.anchor]
            : [selection.anchor, selection.focus];
        const first = start.block.outMostBlock!;
        const last = end.block.outMostBlock!;
        const firstIndex = page.offset(first);
        const lastIndex = page.offset(last);
        const before = buildPartialContainerState(first, start.block, start.offset, 'end');
        const after = buildPartialContainerState(last, end.block, end.offset, 'start');
        const replacement: TState[] = [];
        if (hasContent(before))
            replacement.push(before);
        focusIndex = firstIndex + replacement.length;
        replacement.push(blockFromText(muya, type, muya.getSelectedText()));
        if (hasContent(after))
            replacement.push(after);
        states.splice(firstIndex, lastIndex - firstIndex + 1, ...replacement);
    }
    else {
        const matching = content.getAncestors().filter(block => block.blockName === type);
        const target = matching.at(-1);
        if (target) {
            replaceBlockState(states, target, removeBlockFormat(target.getState(), type));
        }
        else {
            focusIndex++;
            states.splice(focusIndex, 0, blockFromText(muya, type, ''));
        }
    }

    muya.replaceContent(states);
    const result = page.queryBlock([focusIndex]);
    if (!result?.isParent())
        return;
    const leaf = type === 'code-block' && result.blockName === type
        ? result.lastContentInDescendant()
        : result.firstContentInDescendant();
    leaf?.setCursor(0, 0, true);
}
