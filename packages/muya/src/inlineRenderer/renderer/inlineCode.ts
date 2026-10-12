import type { CodeEmojiMathToken, ISyntaxRenderOptions } from '../types';
import type Renderer from './index';
import { CLASS_NAMES } from '../../config';
import { codeColor } from '../../utils/githubMarkdown';

export default function inlineCode(
    this: Renderer,
    {
        h,
        cursor,
        block,
        token,
        outerClass,
    }: ISyntaxRenderOptions & { token: CodeEmojiMathToken },
) {
    const className = this.getClassName(outerClass, block, token, cursor);
    const { marker } = token;
    const { start, end } = token.range;

    const startMarker = this.highlight(
        h,
        block,
        start,
        start + marker.length,
        token,
    );
    const endMarker = this.highlight(h, block, end - marker.length, end, token);
    const content = this.highlight(
        h,
        block,
        start + marker.length,
        end - marker.length,
        token,
    );
    const color = codeColor(token.content);
    if (color) {
        content.push(h('span.github-color-swatch', {
            attrs: { 'style': `background-color:${color}`, 'contenteditable': 'false', 'aria-label': color },
        }));
    }

    return [
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, startMarker),
        h(
            `code.${CLASS_NAMES.MU_INLINE_RULE}`,
            {
                attrs: {
                    spellcheck: 'false',
                },
            },
            content,
        ),
        h(`span.${className}.${CLASS_NAMES.MU_REMOVE}`, endMarker),
    ];
}
