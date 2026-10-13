import type { ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { GITHUB_ALERTS, matchGithubAlert } from '../../utils/githubAlerts';

export default function text(
    this: Renderer,
    { h, block, token, cursor, outerClass }: ISyntaxRenderOptions,
) {
    const { start, end } = token.range;

    const alert = start === 0 && block.blockName === 'paragraph.content' ? matchGithubAlert(block.text) : null;
    if (alert && end >= alert.markerLength) {
        const marker = { ...token, range: { start, end: alert.markerLength } };
        const preview = this.getClassName(outerClass, block, marker, cursor) === 'mu-hide';
        const { title, path } = GITHUB_ALERTS[alert.type];
        return [
            h(`span.mu-alert-marker.${preview ? 'mu-alert-preview' : 'mu-alert-edit'}`, {
                attrs: { 'data-alert': alert.type, 'data-title': title, 'data-start': '0', 'data-end': String(alert.markerLength) },
                style: { '--alert-icon': `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="${path}"/></svg>`)}")` },
            }, [h('span.mu-alert-source', this.highlight(h, block, start, alert.markerLength, token))]),
            h('span.mu-plain-text', this.highlight(h, block, alert.markerLength, end, token)),
        ];
    }

    return [h('span.mu-plain-text', this.highlight(h, block, start, end, token))];
}
