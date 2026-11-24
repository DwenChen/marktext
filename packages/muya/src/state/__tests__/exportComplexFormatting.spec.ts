// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

describe('export complex formatting fidelity', () => {
    it('does not turn single-tilde numeric ranges into strikethrough while keeping double-tilde del', async () => {
        const md = [
            '实测脉宽 180~265 ns，全部合并为 395~440 ns。',
            '',
            '间隔 200~400 ns，合并为 **1.39~1.47 µs** 整块，~~旧方案~~已移除。',
        ].join('\n');

        const html = await new MarkdownToHtml(md).generate({ title: 'Ranges' });

        expect(html).toContain('180~265 ns，全部合并为 395~440 ns');
        expect(html).toContain('<strong>1.39~1.47 µs</strong>');
        expect(html).toContain('<del>旧方案</del>');
        expect(html.match(/<del>/g)?.length).toBe(1);
    });

    it('emits responsive diagram, table, math, and print pagination styles without legacy prism conflicts', async () => {
        const md = [
            '| C1 | C2 | C3 | C4 | C5 | C6 | C7 | C8 |',
            '| --- | --- | --- | --- | --- | --- | --- | --- |',
            '| a | 655.36 | 92.9% | 1051 | b | c | d | e |',
            '',
            '$$W(\\alpha) = T_p + \\tau$$',
        ].join('\n');

        const html = await new MarkdownToHtml(md).generate({ title: 'Complex' });

        expect(html).toContain('overflow-wrap: break-word;');
        expect(html).not.toMatch(/\.markdown-body table th,\s*\.markdown-body table td\s*\{[^}]*overflow-wrap:\s*anywhere/);
        expect(html).toContain('table:has(tr > :nth-child(6))');
        expect(html).toContain('table:has(tr > :nth-child(8))');
        expect(html).toContain('break-inside: avoid;');
        expect(html).toContain('display: table-header-group;');
        expect(html).toContain('class="katex-display"');
        expect(html).not.toContain('text-shadow: 0 1px white');
    });
});
