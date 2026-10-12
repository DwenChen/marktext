import type { ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { ALERTS, alertType } from '../../utils/githubMarkdown';

// render token of text type to vnode.
export default function text(
    this: Renderer,
    { h, block, token, cursor, outerClass }: ISyntaxRenderOptions,
) {
    const { start, end } = token.range;

    const paragraph = block.parent;
    const quote = paragraph?.parent;
    const type = start === 0 && quote?.blockName === 'block-quote' && quote.firstChild === paragraph
        ? alertType(block.text)
        : null;
    if (type) {
        const markerEnd = type.length + 3;
        const marker = { ...token, range: { start, end: markerEnd } };
        const className = this.getClassName(outerClass, block, marker, cursor);
        return [
            h(`span.mu-alert-marker.${className}`, {
                attrs: { 'data-title': ALERTS[type].title },
            }, [
                h('svg.mu-alert-icon', { attrs: { 'viewBox': '0 0 16 16', 'width': '16', 'height': '16', 'aria-hidden': 'true', 'contenteditable': 'false' } }, [h('path', { attrs: { d: ALERTS[type].path } })]),
                ...this.highlight(h, block, start, markerEnd, token),
            ]),
            h('span.mu-plain-text', this.highlight(h, block, markerEnd, end, token)),
        ];
    }

    return [h('span.mu-plain-text', this.highlight(h, block, start, end, token))];
}
