import { describe, expect, it } from 'vitest';
import { wordCount } from '../index';

// Characterization of the current wordCount algorithm in src/utils/index.ts.
// It returns { word, paragraph, character, all }:
//  - paragraph: count of non-empty chunks split on two-or-more newlines.
//  - word: number of CJK chars (一-龥) + number of whitespace tokens
//    in the CJK-stripped string.
//  - character: total length of those non-CJK tokens + number of CJK chars
//    (i.e. excludes whitespace between tokens).
//  - all: the raw markdown string length.
describe('wordCount', () => {
    it('counts plain ASCII words', () => {
        expect(wordCount('hello world')).toEqual({
            word: 2,
            character: 10,
            paragraph: 1,
            all: 11,
        });
    });

    it('counts each CJK character as its own word', () => {
        const result = wordCount('你好 world');
        expect(result.word).toBe(3);
        expect(result.character).toBe(7);
        expect(result.paragraph).toBe(1);
        expect(result.all).toBe(8);
    });

    it('splits paragraphs on blank lines', () => {
        const result = wordCount('a\n\nb\n\nc');
        expect(result.paragraph).toBe(3);
        expect(result.word).toBe(3);
        expect(result.character).toBe(3);
        expect(result.all).toBe(7);
    });

    it('returns all zeros for the empty string', () => {
        expect(wordCount('')).toEqual({
            word: 0,
            character: 0,
            paragraph: 0,
            all: 0,
        });
    });

    it.each([
        '\n',
        '\n\n',
        '\n\n\n',
        ' \n\n ',
        '\n\na\n\n',
        'ab你好cd',
        '你好\n\n世界',
        'a\r\n\r\nb',
        '\u00A0\u1680\u2000\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF',
        'a\u200Bb\u0085c',
        '😀 x\u0301\u9FA5\u9FA6',
    ])('preserves whitespace and mixed-script counting for %j', (markdown) => {
        expect(wordCount(markdown)).toEqual(previousWordCount(markdown));
    });

    it('matches the previous rules across generated mixed-script documents', () => {
        const alphabet = ['a', 'z', '中', '\u9FA5', '\u9FA6', '😀', '\u0301', '\u200B', '\u0085', ' ', '\n', '\r', '\t', '\u00A0', '\u1680', '\u2009', '\u2028', '\uFEFF'];
        let seed = 7919;
        for (let sample = 0; sample < 300; sample++) {
            let markdown = '';
            for (let i = 0; i < sample; i++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                markdown += alphabet[seed % alphabet.length];
            }
            expect(wordCount(markdown)).toEqual(previousWordCount(markdown));
        }
    });
});

function previousWordCount(markdown: string) {
    const paragraph = markdown.split(/\n{2,}/).filter(Boolean).length;
    const withoutChinese = markdown.replace(/[\u4E00-\u9FA5]/g, '');
    const tokens = withoutChinese.split(/\s+/).filter(Boolean);
    const chinese = markdown.length - withoutChinese.length;
    return { paragraph, word: chinese + tokens.length, character: chinese + tokens.reduce((count, token) => count + token.length, 0), all: markdown.length };
}
