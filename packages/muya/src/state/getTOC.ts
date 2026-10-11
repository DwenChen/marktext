import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { Muya } from '../muya';
import { tokenizer, tokensToInlineHtml, tokensToPlainText } from '../inlineRenderer/lexer';
import { getUniqueId } from '../utils';
import { generateGithubSlug } from '../utils/slug';

export interface ITocItem {
    content: string;
    contentHtml: string;
    lvl: number;
    slug: string;
    githubSlug: string;
}

interface IHeadingBlock extends Parent {
    meta: { level: number };
}

const slugCache = new WeakMap<Parent, string>();
const headingCache = new WeakMap<Parent, { text: string; optionsKey: string; labels: unknown; item: ITocItem }>();

export function stableSlug(block: Parent): string {
    let slug = slugCache.get(block);
    if (slug == null) {
        slug = getUniqueId();
        slugCache.set(block, slug);
    }
    return slug;
}

export function getTOC(muya: Muya): ITocItem[] {
    const { scrollPage } = muya.editor;
    if (!scrollPage)
        return [];

    // Headings are tokenized outside a rendered block, so the reference
    // definitions a heading may link to (`[text][ref]`) have to be collected
    // here instead of from the block's own inline renderer.
    const labels = muya.editor.inlineRenderer.collectReferenceDefinitions();
    const { superSubScript, footnote, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, highlightSyntax, inlineDiff } = muya.options;
    const options = { superSubScript, footnote, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, highlightSyntax, inlineDiff };
    const optionsKey = JSON.stringify(options);

    const items: ITocItem[] = [];

    for (const node of scrollPage.children.iterator()) {
        const { blockName } = node;
        if (blockName !== 'atx-heading' && blockName !== 'setext-heading')
            continue;

        const block = node as IHeadingBlock;
        const head = block.children.head as Content | null;
        const text = head?.text ?? '';
        const cached = headingCache.get(block);
        if (cached?.text === text && cached.optionsKey === optionsKey && cached.labels === labels && cached.item.lvl === block.meta.level) {
            items.push({ ...cached.item });
            continue;
        }

        const source = blockName === 'setext-heading'
            ? text.trim()
            : text.replace(/^\s*#{1,6}\s+/, '').trim();

        // One token pass feeds both serializations so the outline's shown text
        // and its slug stay in step; `githubSlug` has to match the anchor id the
        // HTML export injects from `heading.textContent`.
        const tokens = tokenizer(source, {
            hasBeginRules: false,
            labels,
            options,
        });

        const content = tokensToPlainText(tokens).trim();
        const contentHtml = tokensToInlineHtml(tokens).trim();

        const item = {
            content,
            contentHtml,
            lvl: block.meta.level,
            slug: stableSlug(block),
            githubSlug: generateGithubSlug(content),
        };
        headingCache.set(block, { text, optionsKey, labels, item });
        items.push({ ...item });
    }

    return items;
}
