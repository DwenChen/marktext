import type { MarkedExtension } from 'marked';
import { alertTitle, alertType, codeColor, githubReference } from '../../githubMarkdown';

export default function githubExtension(): MarkedExtension {
    return {
        extensions: [{
            name: 'githubReference',
            level: 'inline',
            start(src) {
                for (let i = 0; i < src.length; i++) {
                    if ((src[i] === '@' || /[a-z\d]/i.test(src[i])) && githubReference(src.slice(i), src[i - 1]))
                        return i;
                }
            },
            tokenizer(src) {
                if (this.lexer.state.inLink)
                    return;
                const reference = githubReference(src);
                if (reference)
                    return { type: 'githubReference', ...reference };
            },
            renderer(token) {
                return `<a href="${token.href}">${token.raw}</a>`;
            },
        }],
        renderer: {
            blockquote(token) {
                const first = token.tokens[0];
                const type = first?.type === 'paragraph' ? alertType(first.text) : null;
                if (!type)
                    return false;
                const html = this.parser.parse(token.tokens);
                // The marker is plain text in the first paragraph; parse the body
                // with the original tokens so reference links keep their scope.
                const body = html.replace(/^<p>\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:<\/p>\n?|\r?\n)/, match => match.includes('</p>') ? '' : '<p>');
                return `<div class="markdown-alert markdown-alert-${type.toLowerCase()}">\n${alertTitle(type)}\n${body}</div>\n`;
            },
            codespan(token) {
                const color = codeColor(token.text);
                if (!color)
                    return false;
                return `<code>${token.text}<span class="github-color-swatch" style="background-color:${color}" aria-label="${color}"></span></code>`;
            },
        },
    };
}
