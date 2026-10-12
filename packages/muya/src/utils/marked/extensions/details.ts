import type { MarkedExtension } from 'marked';

export default function detailsExtension(): MarkedExtension {
    return {
        extensions: [{
            name: 'detailsBlock',
            level: 'block',
            tokenizer(src) {
                if (!/^ {0,3}<details(?:\s|>)/i.test(src))
                    return;
                let depth = 0;
                let offset = 0;
                let fence = '';
                for (const line of src.split('\n')) {
                    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
                    if (marker) {
                        if (!fence)
                            fence = marker;
                        else if (marker[0] === fence[0] && marker.length >= fence.length)
                            fence = '';
                    }
                    if (!fence && !marker) {
                        for (const match of line.matchAll(/<\/?details\b[^>]*>/gi)) {
                            depth += match[0][1] === '/' ? -1 : 1;
                            if (depth === 0) {
                                const end = offset + match.index + match[0].length;
                                const raw = src.slice(0, end);
                                return { type: 'html', raw, text: raw, block: true, pre: false };
                            }
                        }
                    }
                    offset += line.length + 1;
                }
            },
        }],
    };
}
