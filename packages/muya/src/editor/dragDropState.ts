import type { TBlockPath } from '../block/types';
import type { TState } from '../state/types';

export function stateAt(states: TState[], path: TBlockPath): TState | undefined {
    let children = states;
    let state: TState | undefined;
    for (const index of path) {
        if (typeof index !== 'number')
            continue;
        state = children[index];
        children = state && 'children' in state ? state.children : [];
    }
    return state;
}

export function pathOf(states: TState[], target: TState, path: TBlockPath = []): TBlockPath | undefined {
    for (const [index, state] of states.entries()) {
        const current = [...path, index];
        if (state === target)
            return current;
        const nested = 'children' in state && pathOf(state.children, target, [...current, 'children']);
        if (nested)
            return nested;
    }
}

export function pruneEmptyLists(states: TState[]): void {
    for (let index = states.length - 1; index >= 0; index--) {
        const state = states[index];
        if (!('children' in state))
            continue;
        pruneEmptyLists(state.children);
        if (/^(?:bullet|order|task)-list$/.test(state.name) && state.children.length === 0)
            states.splice(index, 1);
        else if (['block-quote', 'list-item', 'task-list-item'].includes(state.name) && state.children.length === 0)
            (state.children as TState[]).push({ name: 'paragraph', text: '' });
    }
}

export function removeState(states: TState[], target: TState): void {
    const index = states.indexOf(target);
    if (index >= 0) {
        states.splice(index, 1);
        return;
    }
    for (const state of states) {
        if ('children' in state)
            removeState(state.children, target);
    }
}

function parentOf(states: TState[], target: TState): TState | undefined {
    for (const state of states) {
        if (!('children' in state))
            continue;
        if ((state.children as TState[]).includes(target))
            return state;
        const parent = parentOf(state.children, target);
        if (parent)
            return parent;
    }
}

/** Remove only the vacated paragraph; child lists survive without an empty parent marker. */
export function removeDraggedParagraph(states: TState[], paragraph: TState): void {
    const item = parentOf(states, paragraph);
    removeState(states, paragraph);
    if (item?.name !== 'list-item' && item?.name !== 'task-list-item') {
        pruneEmptyLists(states);
        return;
    }
    if (item.children.length && !item.children.every(child => /^(?:bullet|order|task)-list$/.test(child.name)))
        return;
    const list = parentOf(states, item);
    if (!list || !('children' in list))
        return;
    const entries: TState[] = list.children;
    const index = entries.indexOf(item);
    if (item.children.every(child => child.name === list.name && 'children' in child)) {
        entries.splice(index, 1, ...item.children.flatMap(child => 'children' in child ? child.children : []));
    }
    else {
        const parent = parentOf(states, list);
        const siblings: TState[] = parent && 'children' in parent ? parent.children : states;
        const before = entries.slice(0, index);
        const after = entries.slice(index + 1);
        const parts: TState[] = [];
        if (before.length)
            parts.push(listPart(list, before));
        parts.push(...item.children);
        if (after.length)
            parts.push(listPart(list, after, index));
        siblings.splice(siblings.indexOf(list), 1, ...parts);
    }
    pruneEmptyLists(states);
}

function listPart(list: TState, children: TState[], offset = 0): TState {
    if (list.name === 'order-list')
        return { ...list, meta: { ...list.meta, start: list.meta.start + offset, sourceMarkers: undefined }, children: children as typeof list.children };
    if (list.name === 'task-list') {
        const meta = list.meta.ordered ? { ...list.meta, start: list.meta.start + offset, sourceMarkers: undefined } : { ...list.meta };
        return { ...list, meta, children: children as typeof list.children };
    }
    if (list.name === 'bullet-list')
        return { ...list, children: children as typeof list.children };
    return list;
}
