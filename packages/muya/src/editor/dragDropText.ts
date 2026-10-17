import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, ISelection } from '../selection/types';
import { resolveEndpoint } from '../selection/dom';
import { SelectionType } from '../selection/types';
import { pathOf, removeDraggedParagraph, stateAt } from './dragDropState';
import { imageDragSelection } from './imageDragSelection';
import { canInsertBeside, insertStandaloneText, standaloneTargetAtPoint } from './standaloneTextDrop';
import { TextDropIndicator } from './textDropIndicator';

interface IDragSource {
    selection: ISelection;
    snapshot: string;
    image: boolean;
}

interface ITextDropTarget {
    target: IAnchorFocusInfo;
    after: boolean;
    standalone?: Parent;
}

/** Shared eligibility for the preview and the eventual drop, so forbidden targets never look valid. */
export function getTextDropTarget(muya: Muya, selection: ISelection, target: IAnchorFocusInfo, after: boolean, standalone?: Parent, carryListEntry = true): ITextDropTarget | null {
    if (selection.isCollapsed || !selection.isSelectionInSameBlock || !isLiveText(muya, selection.anchor.block) || !isLiveText(muya, target.block))
        return null;
    if (!standalone && dropsIntoSelection(selection, target))
        return null;
    const start = Math.min(selection.anchor.offset, selection.focus.offset);
    const end = Math.max(selection.anchor.offset, selection.focus.offset);
    const sourceItem = carryListEntry && fullySelectedItem(selection.anchor.block, start, end);
    if (sourceItem && target.block.getAncestors().includes(sourceItem))
        return null;
    if (standalone) {
        if (!canInsertBeside(standalone) || !target.block.getAncestors().includes(standalone))
            return null;
        return { target, after, standalone };
    }
    return { target, after };
}

function itemOf(block: Content): Parent | undefined {
    return block.getAncestors().find(parent => parent.blockName === 'list-item' || parent.blockName === 'task-list-item');
}

function isLiveText(muya: Muya, block: Content): boolean {
    return block.muya === muya && !!block.domNode?.isConnected && block.path.at(-1) === 'text';
}

function fullySelectedItem(block: Content, start: number, end: number): Parent | undefined {
    const item = itemOf(block);
    return start === 0 && end === block.text.length && item?.firstContentInDescendant() === block ? item : undefined;
}

function dropsIntoSelection(selection: ISelection, target: IAnchorFocusInfo): boolean {
    return selection.anchor.block === target.block
        && target.offset >= Math.min(selection.anchor.offset, selection.focus.offset)
        && target.offset <= Math.max(selection.anchor.offset, selection.focus.offset);
}

/** Only a standalone drop carries a fully selected list entry's subtree; caret drops move selected text. */
export function moveDraggedText(muya: Muya, selection: ISelection, target: IAnchorFocusInfo, copy: boolean, after: boolean, standalone?: Parent, carryListEntry = true): boolean {
    const dropTarget = getTextDropTarget(muya, selection, target, after, standalone, carryListEntry);
    if (!dropTarget)
        return false;
    const { anchor, focus } = selection;
    const source = anchor.block;
    const destination = target.block;
    const start = Math.min(anchor.offset, focus.offset);
    const end = Math.max(anchor.offset, focus.offset);
    muya.flush();
    const states = muya.getState();
    if (dropTarget.standalone)
        return insertStandaloneText(muya, states, selection, dropTarget.standalone, copy, after, carryListEntry ? fullySelectedItem(source, start, end) : undefined);
    const sourceState = stateAt(states, source.path);
    const caretState = stateAt(states, destination.path);
    if (!sourceState || !caretState || !('text' in sourceState) || !('text' in caretState))
        return false;
    let offset = target.offset;
    const text = sourceState.text.slice(start, end);
    if (!text)
        return false;
    if (!copy) {
        sourceState.text = sourceState.text.slice(0, start) + sourceState.text.slice(end);
        if (source === destination && offset > end)
            offset -= end - start;
    }
    caretState.text = caretState.text.slice(0, offset) + text + caretState.text.slice(offset);
    if (!copy && source !== destination && sourceState.name === 'paragraph' && sourceState.text === '')
        removeDraggedParagraph(states, sourceState);
    muya.replaceContent(states, selection);
    const block = muya.editor.scrollPage?.queryBlock([...pathOf(states, caretState)!, 'text']);
    if (block?.isContent())
        block.setCursor(offset + text.length, offset + text.length, true);
    return true;
}

function rangeAtPoint(event: { clientX: number; clientY: number }): Range | null {
    const position = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    if (position) {
        const range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
        range.collapse(true);
        return range;
    }
    return document.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;
}

function textAtPoint(muya: Muya, point: { clientX: number; clientY: number }): { range: Range; target: IAnchorFocusInfo } | null {
    const editorRect = muya.domNode.getBoundingClientRect();
    if (point.clientX < editorRect.left || point.clientX > editorRect.right)
        return null;
    // Chromium may return a list container in the indentation gutter, where no text caret exists.
    for (const shift of [0, 24, 64, 128]) {
        const range = rangeAtPoint({ clientX: point.clientX + shift, clientY: point.clientY });
        const target = range && resolveEndpoint(range.startContainer, range.startOffset);
        if (!range || !target || !isLiveText(muya, target.block))
            continue;
        const rect = target.block.domNode!.getBoundingClientRect();
        if (shift === 0 && point.clientY >= rect.top - 7 && point.clientY <= rect.bottom + 7)
            return { range, target };
        if (point.clientX < rect.left && point.clientY >= rect.top && point.clientY <= rect.bottom)
            return { range, target };
    }
    return null;
}

export function attachDragDropTextHandlers(muya: Muya): void {
    const { eventCenter, domNode } = muya;
    const indicator = new TextDropIndicator(domNode);
    let source: IDragSource | null = null;
    let lastPoint: { clientX: number; clientY: number } | null = null;
    const clear = () => {
        source = null;
        lastPoint = null;
        indicator.hide();
    };
    const preview = (point: { clientX: number; clientY: number }): ITextDropTarget | null => {
        indicator.hide();
        if (!source)
            return null;
        const hit = textAtPoint(muya, point);
        if (!hit)
            return null;
        const { range, target } = hit;
        const rect = target.block.domNode!.getBoundingClientRect();
        const standalone = standaloneTargetAtPoint(target.block, point);
        const plan = getTextDropTarget(muya, source.selection, target, point.clientY > rect.top + rect.height / 2, standalone, !source.image);
        if (!plan)
            return null;
        const boundary = plan.standalone;
        if (boundary) {
            indicator.show(boundary.domNode!.getBoundingClientRect(), 'item', plan.after);
        }
        else {
            const caret = range.getBoundingClientRect();
            if (caret.height > 0)
                indicator.show(caret, 'text');
        }
        return plan;
    };
    eventCenter.attachDOMEvent(domNode, 'dragstart', (event) => {
        const image = imageDragSelection(muya, event.target);
        const selection = image ?? muya.getSelection();
        clear();
        if (event.defaultPrevented || (event.target instanceof HTMLImageElement && !image) || !selection || selection.isCollapsed || !selection.isSelectionInSameBlock) {
            event.preventDefault();
            return;
        }
        muya.flush();
        source = { selection, snapshot: JSON.stringify(muya.getState()), image: !!image };
        const transfer = (event as DragEvent).dataTransfer;
        if (image) {
            transfer?.clearData();
            muya.ui.hideAllFloatTools();
            eventCenter.emit('muya-image-toolbar', { reference: null });
            eventCenter.emit('muya-transformer', { reference: null });
        }
        transfer?.setData('text/plain', image
            ? image.anchor.block.text.slice(image.anchor.offset, image.focus.offset)
            : muya.editor.selection.getSelectedText());
        if (transfer)
            transfer.effectAllowed = 'copyMove';
    });
    eventCenter.attachDOMEvent(domNode, 'dragover', (event) => {
        if (source) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const drag = event as DragEvent;
            lastPoint = { clientX: drag.clientX, clientY: drag.clientY };
            const target = preview(lastPoint);
            if (drag.dataTransfer)
                drag.dataTransfer.dropEffect = target ? (drag.ctrlKey || drag.altKey ? 'copy' : 'move') : 'none';
        }
    });
    eventCenter.attachDOMEvent(domNode, 'drop', (event) => {
        const drag = event as DragEvent;
        const internal = source;
        if (!internal)
            return;
        event.preventDefault();
        event.stopImmediatePropagation();
        muya.flush();
        if (internal.snapshot !== JSON.stringify(muya.getState())) {
            clear();
            return;
        }
        const plan = preview(drag);
        clear();
        if (!plan)
            return;
        if (internal.image)
            muya.editor.selection.activate(SelectionType.TEXT);
        moveDraggedText(muya, internal.selection, plan.target, drag.ctrlKey || drag.altKey, plan.after, plan.standalone, !internal.image);
    }, true);
    eventCenter.attachDOMEvent(document, 'dragend', clear);
    eventCenter.attachDOMEvent(domNode, 'dragleave', (event) => {
        const next = (event as DragEvent).relatedTarget;
        if (!(next instanceof Node) || !domNode.contains(next)) {
            lastPoint = null;
            indicator.hide();
        }
    });
    eventCenter.attachDOMEvent(document, 'scroll', () => {
        if (lastPoint)
            preview(lastPoint);
    }, true);
    eventCenter.attachDOMEvent(document, 'keydown', (event) => {
        if ((event as KeyboardEvent).key === 'Escape')
            clear();
    }, true);
    eventCenter.attachDOMEvent(document, 'drop', () => {
        indicator.hide();
        lastPoint = null;
    });
    // Chromium's native drag edits bypass the block tree and cannot be undone.
    eventCenter.attachDOMEvent(domNode, 'beforeinput', (event) => {
        const { inputType } = event as InputEvent;
        if (inputType === 'deleteByDrag' || inputType === 'insertFromDrop')
            event.preventDefault();
    }, true);
}
