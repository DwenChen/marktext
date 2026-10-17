import type { Muya } from '../muya';
import type { ISelection } from '../selection/types';
import { CLASS_NAMES } from '../config';
import { findContentDOM } from '../selection/dom';
import { SelectionCaretType, SelectionDirection } from '../selection/types';
import { getBlock } from '../utils/dom';
import { getImageInfo } from '../utils/image';

/** Image selection has no native text range; move its exact markdown token instead. */
export function imageDragSelection(muya: Muya, target: EventTarget | null): ISelection | null {
    if (!(target instanceof HTMLImageElement))
        return null;
    const wrapper = target.closest<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
    const block = getBlock(findContentDOM(wrapper));
    if (!wrapper || !block?.isContent() || block.muya !== muya || !wrapper.isConnected)
        return null;
    const { token } = getImageInfo(wrapper);
    const { start, end } = token.range;
    if (block.text.slice(start, end) !== token.raw)
        return null;
    return {
        anchor: { block, path: block.path, offset: start },
        focus: { block, path: block.path, offset: end },
        isCollapsed: false,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    };
}
