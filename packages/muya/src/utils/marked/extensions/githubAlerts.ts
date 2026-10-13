import type { MarkedExtension, Token, Tokens } from 'marked';
import { githubAlertTitle, matchGithubAlert } from '../../githubAlerts';

function withoutMarker(tokens: Token[], length: number): Token[] {
    const body: Token[] = [];
    for (const token of tokens) {
        if (length >= token.raw.length) {
            length -= token.raw.length;
        }
        else if (length > 0 && token.type === 'text') {
            body.push({ ...token, raw: token.raw.slice(length), text: token.text.slice(length) });
            length = 0;
        }
        else {
            body.push(token);
        }
    }
    return body;
}

export default function githubAlertsExtension(): MarkedExtension {
    let topLevel = new WeakSet<Token>();
    return {
        hooks: {
            processAllTokens(tokens) {
                topLevel = new WeakSet(tokens);
                // Raw HTML can open a container across separate Markdown tokens.
                if (tokens.some(token => token.type === 'html') && tokens.some(token => token.type === 'blockquote' && matchGithubAlert(token.text))) {
                    const shell = tokens.map((token, index) => token.type === 'html' ? token.raw : `<div data-alert-index="${index}"></div>`).join('\n');
                    const doc = new DOMParser().parseFromString(shell, 'text/html');
                    topLevel = new WeakSet(Array.from(doc.body.children).flatMap((element) => {
                        const index = element.getAttribute('data-alert-index');
                        const token = index === null ? undefined : tokens[Number(index)];
                        return token?.type === 'blockquote' ? [token] : [];
                    }));
                }
                return tokens;
            },
        },
        renderer: {
            blockquote(token) {
                const first = token.tokens[0];
                const alert = topLevel.has(token) && first?.type === 'paragraph' ? matchGithubAlert(first.text) : null;
                if (!alert)
                    return false;

                // Keep parsed inline tokens so body references retain the document's definitions.
                const paragraph = first as Tokens.Paragraph;
                const body = token.tokens.slice(1);
                const inlineBody = withoutMarker(paragraph.tokens, alert.length);
                if (inlineBody.length)
                    body.unshift({ ...paragraph, tokens: inlineBody });

                return `<div class="markdown-alert markdown-alert-${alert.type.toLowerCase()}">\n${githubAlertTitle(alert.type)}\n${this.parser.parse(body)}</div>\n`;
            },
        },
    };
}
