import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import type { ISelection } from '../selection/types';
import type { TState } from '../state/types';
import { pathOf, pruneEmptyLists, removeDraggedParagraph, removeState, stateAt } from './dragDropState';

const PARAGRAPH_CONTAINERS = new Set(['block-quote', 'list-item', 'task-list-item']);
const LEAF_BLOCKS = new Set(['paragraph', 'atx-heading', 'setext-heading', 'code-block', 'math-block', 'html-block']);

export function canInsertBeside(block: Parent): boolean {
    if (block.blockName === 'list-item' || block.blockName === 'task-list-item')
        return true;
    return LEAF_BLOCKS.has(block.blockName) && !!block.parent
        && (block.parent.isScrollPage || PARAGRAPH_CONTAINERS.has(block.parent.blockName));
}

/** Edges create a separate block; a list's left gutter also selects the indicated ancestor level. */
export function standaloneTargetAtPoint(content: Content, point: { clientX: number; clientY: number }): Parent | undefined {
    const wrapper = content.parent;
    if (!wrapper || !canInsertBeside(wrapper))
        return;
    const rect = wrapper.domNode!.getBoundingClientRect();
    const edge = Math.min(7, rect.height / 4);
    const gutter = point.clientX < content.domNode!.getBoundingClientRect().left;
    if (!gutter && point.clientY > rect.top + edge && point.clientY < rect.bottom - edge)
        return;
    const parent = wrapper.parent!;
    if (parent.blockName !== 'list-item' && parent.blockName !== 'task-list-item')
        return wrapper;
    const items = content.getAncestors().filter(block => block.blockName === 'list-item' || block.blockName === 'task-list-item');
    return items.find(block => point.clientX >= block.domNode!.getBoundingClientRect().left - 8) ?? items.at(-1);
}

function destinationChildren(states: TState[], anchor: Parent): TState[] | undefined {
    if (anchor.parent!.isScrollPage)
        return states;
    const container = stateAt(states, anchor.parent!.path);
    return container && 'children' in container ? container.children : undefined;
}

function insertedBlocks(anchor: TState, entry: TState | undefined, text: string): TState[] {
    const blocks: TState[] = entry && 'children' in entry ? structuredClone(entry.children) : [{ name: 'paragraph', text }];
    if (anchor.name === 'task-list-item')
        return [{ name: 'task-list-item', meta: { checked: entry?.name === 'task-list-item' && entry.meta.checked }, children: blocks }];
    if (anchor.name === 'list-item')
        return [{ name: 'list-item', children: blocks }];
    return blocks;
}

export function insertStandaloneText(muya: Muya, states: TState[], selection: ISelection, anchor: Parent, copy: boolean, after: boolean, sourceItem?: Parent): boolean {
    const source = selection.anchor.block;
    const state = stateAt(states, source.path);
    const anchorState = stateAt(states, anchor.path);
    const children = destinationChildren(states, anchor);
    if (!state || !('text' in state) || !anchorState || !children)
        return false;
    const start = Math.min(selection.anchor.offset, selection.focus.offset);
    const end = Math.max(selection.anchor.offset, selection.focus.offset);
    const text = state.text.slice(start, end);
    if (!text)
        return false;
    const entry = sourceItem && stateAt(states, sourceItem.path);
    const inserted = insertedBlocks(anchorState, entry, text);
    children.splice(children.indexOf(anchorState) + Number(after), 0, ...inserted);
    if (!copy) {
        if (entry)
            removeState(states, entry);
        else if (state.name === 'paragraph' && start === 0 && end === source.text.length)
            removeDraggedParagraph(states, state);
        else
            state.text = state.text.slice(0, start) + state.text.slice(end);
    }
    pruneEmptyLists(states);
    const path = pathOf(states, inserted[0]);
    if (!path)
        return false;
    muya.replaceContent(states, selection);
    const result = muya.editor.scrollPage?.queryBlock(path);
    if (result?.isParent())
        result.firstContentInDescendant()?.setCursor(text.length, text.length, true);
    return true;
}
