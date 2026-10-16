import type { Muya } from '../muya';
import type { TState } from '../state/types';
import type Parent from './base/parent';

export type TTypingLevelDirection = 'previous' | 'next';

interface ITypingTarget {
    block: Parent;
    index: number;
}

const LEVEL_BLOCKS = new Set(['bullet-list', 'order-list', 'task-list', 'block-quote', 'table', 'code-block', 'math-block']);
const LIST_BLOCKS = new Set(['bullet-list', 'order-list', 'task-list']);

function directChild(container: Parent, descendant: Parent): Parent | null {
    let child = descendant;
    while (child.parent && child.parent !== container)
        child = child.parent;
    return child.parent === container ? child : null;
}

function childLevel(current: Parent, content: Parent): Parent | undefined {
    const scope = LIST_BLOCKS.has(current.blockName) ? directChild(current, content) : current;
    if (!scope || (!LIST_BLOCKS.has(current.blockName) && current.blockName !== 'block-quote'))
        return;
    const anchor = directChild(scope, content);
    const offset = anchor ? scope.offset(anchor) : -1;
    const candidates = scope.map(node => node.isParent() && LEVEL_BLOCKS.has(node.blockName) ? node : null)
        .filter((node): node is Parent => node !== null);
    return candidates.find(node => scope.offset(node) > offset) ?? candidates.at(-1);
}

function typingTargets(muya: Muya): Partial<Record<TTypingLevelDirection, ITypingTarget>> {
    const selection = muya.getSelection();
    if (!selection?.isCollapsed)
        return {};
    const content = selection.focus.block;
    const levels = content.getAncestors().filter(block => LEVEL_BLOCKS.has(block.blockName) || block.isScrollPage);
    const current = levels[0];
    if (!current || current.isScrollPage || !content.parent)
        return {};
    const parent = levels[1];
    const anchor = parent && directChild(parent, current);
    const child = childLevel(current, content.parent);
    return {
        ...(parent && anchor ? { previous: { block: parent, index: parent.offset(anchor) + 1 } } : {}),
        ...(child ? { next: { block: child, index: child.length() } } : {}),
    };
}

export function getTypingLevels(muya: Muya): TTypingLevelDirection[] {
    const targets = typingTargets(muya);
    return (['previous', 'next'] as const).filter(direction => targets[direction]);
}

function stateChildren(states: TState[], container: Parent): TState[] {
    let children = states;
    for (const index of container.path.filter((part): part is number => typeof part === 'number')) {
        const state = children[index];
        if (!state || !('children' in state))
            throw new Error('Invalid typing level path');
        children = state.children;
    }
    return children;
}

function isEmptyInput(state: TState | undefined): boolean {
    if (!state)
        return false;
    if (state.name === 'list-item' || state.name === 'task-list-item')
        return state.children.length === 1 && isEmptyInput(state.children[0]);
    return state.name === 'paragraph' && state.text === '';
}

/** Continue at an existing parent/child level; any created input is one undo step. */
export function typeAtLevel(muya: Muya, direction: TTypingLevelDirection): void {
    if (direction !== 'previous' && direction !== 'next')
        return;
    muya.flush();
    const target = typingTargets(muya)[direction];
    if (!target)
        return;
    const { block } = target;
    if (!block.isScrollPage && !LIST_BLOCKS.has(block.blockName) && block.blockName !== 'block-quote') {
        const content = block.lastContentInDescendant();
        content?.setCursor(content.text.length, content.text.length, true);
        return;
    }
    const states = muya.getState();
    const children = stateChildren(states, block);
    let index = target.index;
    if (direction === 'next' && isEmptyInput(children.at(-1)))
        index--;
    const path = [...block.path, index];
    if (!isEmptyInput(children[index])) {
        const paragraph: TState = { name: 'paragraph', text: '' };
        const input: TState = block.blockName === 'task-list'
            ? { name: 'task-list-item', meta: { checked: false }, children: [paragraph] }
            : LIST_BLOCKS.has(block.blockName) ? { name: 'list-item', children: [paragraph] } : paragraph;
        children.splice(index, 0, input);
        muya.replaceContent(states);
    }
    const result = muya.editor.scrollPage?.queryBlock(path);
    if (result?.isParent())
        result.firstContentInDescendant()?.setCursor(0, 0, true);
}
