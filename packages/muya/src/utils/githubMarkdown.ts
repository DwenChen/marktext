export const ALERTS = {
    NOTE: { title: 'Note', symbol: 'ⓘ', path: 'M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm0 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13ZM8 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-.75 3v5h1.5V7Z' },
    TIP: { title: 'Tip', symbol: '♧', path: 'M8 0a5 5 0 0 0-3.5 8.57c.6.6 1 1.22 1 1.93v1h5v-1c0-.71.4-1.33 1-1.93A5 5 0 0 0 8 0Zm0 1.5a3.5 3.5 0 0 1 2.45 6c-.74.73-1.22 1.56-1.4 2.5h-2.1c-.18-.94-.66-1.77-1.4-2.5A3.5 3.5 0 0 1 8 1.5ZM5.5 13h5v1.5h-5Zm1 2h3v1h-3Z' },
    IMPORTANT: { title: 'Important', symbol: '❕', path: 'M2 1h12a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6l-4 3V2a1 1 0 0 1 1-1Zm1.5 1.5v9.5l2.5-1.5h7.5v-8ZM7.25 4h1.5v3.5h-1.5ZM8 8.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z' },
    WARNING: { title: 'Warning', symbol: '⚠', path: 'M7.35 1.3a.75.75 0 0 1 1.3 0l7 12A.75.75 0 0 1 15 14.5H1a.75.75 0 0 1-.65-1.2ZM8 3.2 2.3 13h11.4ZM7.25 6h1.5v3.5h-1.5ZM8 10.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z' },
    CAUTION: { title: 'Caution', symbol: '⛔', path: 'M4.5 0h7L16 4.5v7L11.5 16h-7L0 11.5v-7Zm.6 1.5L1.5 5.1v5.8l3.6 3.6h5.8l3.6-3.6V5.1l-3.6-3.6ZM7.25 4h1.5v5h-1.5ZM8 10a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z' },
} as const;

export type TAlert = keyof typeof ALERTS;

export function alertType(text: string): TAlert | null {
    const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*(?:\r?\n|$)/.exec(text);
    return match ? match[1] as TAlert : null;
}

export function alertTitle(type: TAlert): string {
    const { title, path } = ALERTS[type];
    return `<p class="markdown-alert-title"><svg class="octicon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="${path}"></path></svg>${title}</p>`;
}

export function codeColor(text: string): string | null {
    if (/^#[\da-f]{6}$/i.test(text))
        return text;
    const rgb = /^rgb\((\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\)$/.exec(text);
    if (rgb && rgb.slice(1).every(n => Number(n) <= 255))
        return text;
    const hsl = /^hsl\((\d{1,3}),\s*(\d{1,3})%,\s*(\d{1,3})%\)$/.exec(text);
    if (hsl && Number(hsl[1]) <= 360 && hsl.slice(2).every(n => Number(n) <= 100))
        return text;
    return null;
}

export function githubReference(text: string, previous = ''): { raw: string; href: string } | null {
    if (previous && /[\w/@]/.test(previous))
        return null;
    const match = /^(?:@([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)(?:\/([a-z\d][a-z\d-]*))?|([a-z\d][a-z\d-]*)\/([\w.-]+)#(\d+))(?![\w-])/i.exec(text);
    if (!match)
        return null;
    if (match[1] && /^\.[a-z\d]/i.test(text.slice(match[0].length)))
        return null;
    const href = match[3]
        ? `https://github.com/${match[3]}/${match[4]}/issues/${match[5]}`
        : match[2]
            ? `https://github.com/orgs/${match[1]}/teams/${match[2]}`
            : `https://github.com/${match[1]}`;
    return { raw: match[0], href };
}
