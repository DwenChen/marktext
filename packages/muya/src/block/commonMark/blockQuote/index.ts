import type { Muya } from '../../../muya';
import type { IBlockQuoteState } from '../../../state/types';
import { mixins } from '../../../utils';
import { alertType } from '../../../utils/githubMarkdown';
import Parent from '../../base/parent';
import IContainerQueryBlock from '../../mixins/containerQueryBlock';
import { ScrollPage } from '../../scrollPage';

@mixins(IContainerQueryBlock)
class BlockQuote extends Parent {
    static override blockName = 'block-quote';

    private _meta?: IBlockQuoteState['meta'];

    static create(muya: Muya, state: IBlockQuoteState) {
        const blockQuote = new BlockQuote(muya);
        blockQuote._meta = state.meta;

        for (const child of state.children)
            blockQuote.append(ScrollPage.loadBlock(child.name).create(muya, child));

        const first = state.children[0];
        const type = first?.name === 'paragraph' ? alertType(first.text) : null;
        if (type) {
            blockQuote.domNode!.classList.add('mu-github-alert', `markdown-alert-${type.toLowerCase()}`);
            blockQuote.firstContentInDescendant()?.update();
        }

        return blockQuote;
    }

    override get path() {
        const { path: pPath } = this.parent!;
        const offset = this.parent!.offset(this);

        return [...pPath, offset, 'children'];
    }

    constructor(muya: Muya) {
        super(muya);
        this.tagName = 'blockquote';
        this.classList = ['mu-block-quote'];
        this.createDomNode();
    }

    override getState(): IBlockQuoteState {
        const state: IBlockQuoteState = {
            name: 'block-quote',
            children: this.children.map(child => (child as Parent).getState()),
        };

        if (this._meta)
            state.meta = this._meta;

        return state;
    }
}

export default BlockQuote;
