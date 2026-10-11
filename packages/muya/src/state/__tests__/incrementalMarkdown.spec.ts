import type { IBulletListState, ITableState, TState } from '../types';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function parse(markdown: string) {
    return new MarkdownToState({
        footnote: true,
        texMathDollars: true,
        texMathGfm: true,
        texMathSingleBackslash: false,
        texMathDoubleBackslash: false,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: true,
        multilineBlockquote: true,
    }).generate(markdown);
}

function bullet(text: string, marker = '-', loose = false): IBulletListState {
    return {
        name: 'bullet-list',
        meta: { marker, loose },
        children: [{ name: 'list-item', children: [{ name: 'paragraph', text }] }],
    };
}

describe('immutable markdown fragment cache', () => {
    it('does not read unchanged paragraph text after a local edit', () => {
        const reads = Array.from({ length: 1000 }, (_, index) => vi.fn(() => `paragraph ${index}`));
        const states: TState[] = reads.map(read => ({
            name: 'paragraph',
            get text() {
                return read();
            },
        }));
        const exporter = new ExportMarkdown();
        exporter.generateIncremental(states);
        reads.forEach(read => read.mockClear());

        const next: TState[] = states.slice();
        next[500] = { name: 'paragraph', text: 'updated' };
        const markdown = exporter.generateIncremental(next);

        expect(markdown).toContain('\n\nupdated\n\n');
        expect(reads.reduce((total, read) => total + read.mock.calls.length, 0)).toBe(0);
        expect(markdown).toBe(new ExportMarkdown().generate(next));
    });

    it('keeps the uncached API sensitive to mutable inputs', () => {
        const state = { name: 'paragraph' as const, text: 'before' };
        const exporter = new ExportMarkdown();
        exporter.generateIncremental([state]);
        state.text = 'after';

        expect(exporter.generate([state])).toBe('after\n');
    });

    it('updates spacing when unchanged blocks move, insert or disappear', () => {
        const first: TState = { name: 'paragraph', text: 'first' };
        const second: TState = { name: 'atx-heading', meta: { level: 2 }, text: '## second' };
        const quote: TState = { name: 'block-quote', children: [{ name: 'paragraph', text: 'quoted' }] };
        const exporter = new ExportMarkdown();

        for (const states of [[first, second, quote], [quote, second, first], [first], [second, first], []])
            expect(exporter.generateIncremental(states)).toBe(new ExportMarkdown().generate(states));
    });

    it('recomputes adjacent list spacing when the previous marker or tightness changes', () => {
        const first = bullet('one');
        const second = bullet('two');
        const exporter = new ExportMarkdown();
        expect(exporter.generateIncremental([first, second])).toBe('- one\n- two\n');

        const loose = { ...first, meta: { ...first.meta, loose: true } };
        expect(exporter.generateIncremental([loose, second])).toBe('- one\n\n- two\n');

        const differentMarker = { ...first, meta: { ...first.meta, marker: '*' } };
        expect(exporter.generateIncremental([differentMarker, second])).toBe('* one\n- two\n');
        expect(exporter.generateIncremental([second])).toBe('- two\n');
    });

    it('keeps adjacent plain and task items tight across cache hits', () => {
        const states = parse('- one\n- [x] two\n- three\n\ntext\n');
        const exporter = new ExportMarkdown();
        const before = exporter.generateIncremental(states);
        const next = states.map(state => state.name === 'paragraph' ? { ...state, text: 'edited' } : state);

        expect(exporter.generateIncremental(states)).toBe(before);
        expect(exporter.generateIncremental(next)).toBe(new ExportMarkdown().generate(next));
        expect(exporter.generateIncremental(states)).toBe(before);
        expect(before).toBe('- one\n- [x] two\n- three\n\ntext\n');
    });

    it.each([1, 4, 'dfm'])('preserves nested numbering and indentation with option %s', (listIndentation) => {
        const states = parse('007) one\n008) two\n     - nested\n\ntext\n');
        const exporter = new ExportMarkdown({ listIndentation });
        const before = new ExportMarkdown({ listIndentation }).generate(states);
        expect(exporter.generateIncremental(states)).toBe(before);

        const next = states.map(state => state.name === 'paragraph' ? { ...state, text: 'edited' } : state);
        expect(exporter.generateIncremental(next)).toBe(new ExportMarkdown({ listIndentation }).generate(next));
        expect(exporter.generateIncremental(states)).toBe(before);
    });

    it('recalculates the entire table when one cell changes its visual width', () => {
        const states = parse('| h | b |\n| :-- | --: |\n| x | 文 |\n\ntext\n');
        const table = states[0] as ITableState;
        const exporter = new ExportMarkdown();
        exporter.generateIncremental(states);
        const nextTable: ITableState = {
            ...table,
            children: table.children.map((row, rowIndex) => rowIndex === 1
                ? { ...row, children: row.children.map((cell, columnIndex) => columnIndex === 0 ? { ...cell, text: '長い文字' } : cell) }
                : row),
        };
        const next = [nextTable, ...states.slice(1)];

        expect(exporter.generateIncremental(next)).toBe(new ExportMarkdown().generate(next));
        expect(exporter.generateIncremental(next)).toContain('| h        |');
    });

    it('preserves footnotes, fenced blockquotes, frontmatter, math and code fences', () => {
        const states = parse([
            '---',
            'title: test',
            '---',
            '',
            '>>>',
            'quote',
            '',
            '- nested',
            '>>>',
            '',
            'ref[^note]',
            '',
            '[^note]: first',
            '',
            '    - nested',
            '',
            '$$',
            'a + b',
            '$$',
            '',
            '````js title="code"',
            '```',
            '````',
            '',
        ].join('\n'));
        const exporter = new ExportMarkdown();
        const before = new ExportMarkdown().generate(states);
        expect(exporter.generateIncremental(states)).toBe(before);

        const next = states.map(state => state.name === 'paragraph' ? { ...state, text: 'changed[^note]' } : state);
        expect(exporter.generateIncremental(next)).toBe(new ExportMarkdown().generate(next));
        expect(exporter.generateIncremental(states)).toBe(before);
    });
});
