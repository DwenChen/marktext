import type Format from '../block/base/format';
import type ParagraphContent from '../block/content/paragraphContent';
import type { Muya } from '../muya';
import type { IRenderCursor } from '../selection/types';
import type { IParagraphState, TContainerState, TState } from '../state/types';
import type { IHighlight, Labels } from './types';
import { alertType } from '../utils/githubMarkdown';
import logger from '../utils/logger';
import { tokenizer } from './lexer';
import Renderer from './renderer';
import { beginRules } from './rules';

const debug = logger('inlineRenderer:');

class InlineRenderer {
    public labels: Labels = new Map();
    public renderer: Renderer;

    private _labelsRevision = -1;
    private _definitionsByState = new WeakMap<TState, Labels>();

    constructor(public muya: Muya) {
        this.renderer = new Renderer(muya, this);
    }

    private _tokenizer(block: Format, highlights: IHighlight[]) {
        const { options } = this.muya;
        const { text } = block;
        const { labels } = this;

        // TODO: different content block should have different rules.
        // eg: atxheading.content has no soft|hard line break
        // setextheading.content has no heading rules.
        const hasBeginRules
            = /thematicbreak\.content|paragraph\.content|atxheading\.content/.test(
                block.blockName,
            );

        return tokenizer(text, { hasBeginRules, labels, options, highlights });
    }

    /**
     * Flush every cached image and force inline images to reload.
     *
     * The renderer memoises loaded images in `loadImageMap` (keyed by src,
     * skipped on the next render once `isSuccess` is true) and resolved URLs
     * in `urlMap`. When an image file changes on disk the cached entry would
     * otherwise keep the stale bitmap, so clearing both maps and re-rendering
     * every content block re-runs `loadImageAsync`, which loads the source
     * afresh.
     */
    invalidateImageCache() {
        this.renderer.clearImageCache();

        const { scrollPage } = this.muya.editor;
        if (!scrollPage)
            return;

        scrollPage.breadthFirstTraverse((node) => {
            if (node.isContent())
                node.update();
        });
    }

    resetDocumentCaches() {
        this.renderer.clearImageCache();
        this.renderer.loadMathMap.clear();
        this.labels.clear();
        this._labelsRevision = -1;
        this._definitionsByState = new WeakMap();
    }

    patch(block: Format, cursor?: IRenderCursor, highlights: IHighlight[] = []) {
        const paragraph = block.parent;
        const quote = paragraph?.parent;
        if (block.blockName === 'paragraph.content' && quote?.blockName === 'block-quote' && quote.firstChild === paragraph) {
            const type = alertType(block.text);
            quote.domNode!.classList.toggle('mu-github-alert', !!type);
            for (const name of ['note', 'tip', 'important', 'warning', 'caution'])
                quote.domNode!.classList.toggle(`markdown-alert-${name}`, type?.toLowerCase() === name);
        }
        this.labels = this.collectReferenceDefinitions();
        const { domNode } = block;
        if (block.isParent())
            debug.error('Patch can only handle content block');

        const tokens = this._tokenizer(block, highlights);
        const html = this.renderer.output(
            tokens,
            block,
            cursor && cursor.block === block ? cursor : {},
        );
        domNode!.innerHTML = html;
    }

    // Reference definitions (`[ref]: url`) live in their own paragraphs, so
    // resolving `[text][ref]` needs a document-wide pass. Shared with
    // `getTOC`, which tokenizes headings outside a rendered block.
    collectReferenceDefinitions(): Labels {
        const { jsonState } = this.muya.editor;
        if (this._labelsRevision === jsonState.revision)
            return this.labels;
        const state = jsonState.getReadonlyState();
        const labels = new Map();

        const travel = (sts: readonly TState[]) => {
            if (Array.isArray(sts) && sts.length) {
                for (const st of sts) {
                    const cached = this._definitionsByState.get(st);
                    if (cached) {
                        for (const [label, info] of cached) labels.set(label, info);
                        continue;
                    }
                    const definitions: Labels = new Map();
                    if (st.name === 'paragraph') {
                        const { label, info } = this.getLabelInfo(st);
                        if (label && info) {
                            labels.set(label, info);
                            definitions.set(label, info);
                        }
                    }
                    else if ((st as TContainerState).children) {
                        travel((st as TContainerState).children);
                    }
                    if (st.name === 'paragraph' || !(st as TContainerState).children)
                        this._definitionsByState.set(st, definitions);
                }
            }
        };

        travel(state);
        this._labelsRevision = jsonState.revision;
        if (labels.size === this.labels.size && [...labels].every(([key, value]) => {
            const previous = this.labels.get(key);
            return previous?.href === value.href && previous?.title === value.title;
        })) {
            return this.labels;
        }
        this.labels = labels;
        return labels;
    }

    getLabelInfo(blockOrState: ParagraphContent | IParagraphState) {
        const { text } = blockOrState;
        const tokens = beginRules.reference_definition.exec(text);
        let label = null;
        let info = null;
        if (tokens) {
            label = (tokens[2] + tokens[3]).toLowerCase();
            info = {
                href: tokens[6],
                title: tokens[10] || '',
            };
        }

        return { label, info };
    }
}

export default InlineRenderer;
