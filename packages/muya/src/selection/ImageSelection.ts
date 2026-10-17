import type Format from '../block/base/format';
import type { Muya } from '../muya';
import type { TState } from '../state/types';
import type Selection from './index';
import type { IImageSelectionData } from './types';
import { BLOCK_DOM_PROPERTY, CLASS_NAMES } from '../config';
import { LINK_SELECTOR } from '../editor/linkMouseEvents';
import { isHTMLElement, isKeyboardEvent } from '../utils';
import { getImageInfo, getImageSrc } from '../utils/image';
import { findContentDOM } from './dom';
import { SelectionType } from './types';

class ImageSelection {
    selected: IImageSelectionData | null = null;

    constructor(private _muya: Muya, private _selection: Selection) {}

    attach(): void {
        const { eventCenter, domNode } = this._muya;
        eventCenter.attachDOMEvent(domNode, 'click', this._handleClick);
        eventCenter.attachDOMEvent(document, 'click', this._handleDocClick);
        // Image selection leaves a stale DOM text range; consume its keys before text blocks.
        eventCenter.attachDOMEvent(document, 'keydown', this._handleKeydown, true);
    }

    clear(): void {
        this.selected = null;
    }

    private _handleDocClick = (): void => {
        this.selected = null;
    };

    private _handleClick = (event: Event): void => {
        const { target } = event;
        if (!isHTMLElement(target))
            return;
        const imageWrapper = target.closest<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`);
        this.selected = null;
        if (imageWrapper)
            this._handleClickInlineImage(event, imageWrapper);
    };

    private _handleKeydown = (event: Event): void => {
        if (!isKeyboardEvent(event))
            return;
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.isComposing)
            return;

        const { key } = event;
        const { selected } = this;
        if (!selected)
            return;

        if (!selected.block.outMostBlock) {
            this.selected = null;
            return;
        }

        if (key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            this._previewSelectedImage(selected);
            return;
        }

        if (key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const { block, token } = selected;
            this._selection.activate(SelectionType.TEXT);
            this._enterAfterImage(block, token.range.end);
            return;
        }

        if (/^(?:Backspace|Delete)$/.test(key)) {
            event.preventDefault();
            event.stopPropagation();
            const { block, ...imageInfo } = selected;
            block.deleteImage(imageInfo);
            this._selection.activate(SelectionType.TEXT);
        }
    };

    private _enterAfterImage(block: Format, offset: number): void {
        const paragraph = block.parent;
        if (!paragraph || paragraph.blockName !== 'paragraph') {
            block.setCursor(offset, offset, true);
            return;
        }
        const muya = this._muya;
        muya.flush();
        const states = muya.getState();
        let children = states;
        for (const index of paragraph.parent!.path) {
            if (typeof index !== 'number')
                continue;
            const state = children[index];
            if (!state || !('children' in state))
                return;
            children = state.children;
        }
        const index = paragraph.parent!.offset(paragraph);
        const state = children[index];
        if (state?.name !== 'paragraph')
            return;
        const next: TState = { name: 'paragraph', text: state.text.slice(offset) };
        state.text = state.text.slice(0, offset);
        const item = paragraph.parent!;
        let path = [...item.path, index + 1];
        if (item.blockName === 'list-item' || item.blockName === 'task-list-item') {
            let listStates = states;
            for (const index of item.parent!.path) {
                if (typeof index !== 'number')
                    continue;
                const state = listStates[index];
                if (!state || !('children' in state))
                    return;
                listStates = state.children;
            }
            const index = item.parent!.offset(item) + 1;
            listStates.splice(index, 0, item.blockName === 'task-list-item'
                ? { name: 'task-list-item', meta: { checked: false }, children: [next] }
                : { name: 'list-item', children: [next] });
            path = [...item.parent!.path, index];
        }
        else {
            children.splice(index + 1, 0, next);
        }
        // Atomic image DOM nodes cannot reliably represent a caret after the image.
        muya.replaceContent(states);
        const input = muya.editor.scrollPage?.queryBlock(path);
        if (input?.isParent())
            input.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    private _previewSelectedImage(selected: IImageSelectionData) {
        const { token, imageId } = selected;
        const tokenSrc = token.src || token.attrs.src || '';
        const imgSrc
            = this._muya.domNode
                .querySelector<HTMLImageElement>(`#${imageId} img`)
                ?.getAttribute('src') ?? '';
        const src = getImageSrc(tokenSrc).src || imgSrc;

        if (src) {
            this._muya.eventCenter.emit('preview-image', {
                data: src,
            });
        }
    }

    private _imageWrappers(contentDom: HTMLElement): HTMLElement[] {
        return Array.from(
            contentDom.querySelectorAll<HTMLElement>(`.${CLASS_NAMES.MU_INLINE_IMAGE}`),
        );
    }

    private _handleClickInlineImage(event: Event, imageWrapper: HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        const { eventCenter } = this._muya;
        const imageInfo = getImageInfo(imageWrapper);
        const { target } = event;
        if (!(target instanceof Node))
            return;
        const deleteContainer = isHTMLElement(target)
            ? target.closest('.mu-image-icon-close')
            : null;
        const contentDom = findContentDOM(target);

        if (!contentDom)
            return;

        const contentBlock = contentDom[BLOCK_DOM_PROPERTY] as Format;

        if (deleteContainer) {
            contentBlock.deleteImage(imageInfo);

            return;
        }

        if (isHTMLElement(target) && target.tagName === 'IMG') {
            // A linked image (e.g. `[![alt](src)](href)`) renders its image
            // wrapper inside a link element. On modifier-click the link handler
            // (linkMouseEvents) opens the URL; don't also emit the image preview,
            // which would pop a viewer over the navigation (#3835). Reuse
            // linkMouseEvents' selector so every link variant is covered (plain,
            // reference, autolink, raw-HTML anchor), not just `mu-link`.
            if (
                event instanceof MouseEvent
                && (event.metaKey || event.ctrlKey)
                && !imageWrapper.closest(LINK_SELECTOR)
            ) {
                const tokenSrc = imageInfo.token.src || imageInfo.token.attrs.src || '';
                const src = getImageSrc(tokenSrc).src || target.getAttribute('src') || '';
                if (src) {
                    eventCenter.emit('format-click', {
                        event,
                        formatType: 'image',
                        data: src,
                    });
                }
            }

            // Identify the clicked image by its position among the paragraph's
            // images, which survives the re-render below — the node does not,
            // and ids are not unique (images sharing a src and paragraph offset
            // render with the same id, so a `#id` lookup finds the first one).
            const imageIndex = this._imageWrappers(contentDom).indexOf(imageWrapper);

            // Selecting the image blurs the paragraph, and `Format.blurHandler`
            // re-renders it whenever the caret sat on a token's markers — which
            // a caret on the image's own line always does. The re-render
            // reassigns the paragraph's `innerHTML`, detaching `imageWrapper`,
            // and the markers it hides can shift the image sideways. So select
            // first and take both references off the live DOM afterwards: from
            // the detached node the resize bar reads a zero rect and draws its
            // handles in the window's corner, and the toolbar a stale one (#5391).
            this._selection.selectImage(Object.assign({}, imageInfo, { block: contentBlock }));

            const liveWrapper = this._imageWrappers(contentDom)[imageIndex] ?? imageWrapper;
            const imageContainer = liveWrapper.querySelector(
                `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
            );
            const rect = imageContainer?.getBoundingClientRect();

            eventCenter.emit('muya-image-toolbar', {
                block: contentBlock,
                reference: {
                    getBoundingClientRect: () => rect,
                    width: liveWrapper.offsetWidth,
                    height: liveWrapper.offsetHeight,
                },
                imageInfo,
            });

            eventCenter.emit('muya-transformer', {
                block: contentBlock,
                reference: imageContainer,
                imageInfo,
            });

            return;
        }

        if (
            imageWrapper.classList.contains(CLASS_NAMES.MU_EMPTY_IMAGE)
            || imageWrapper.classList.contains(CLASS_NAMES.MU_IMAGE_FAIL)
        ) {
            const rect = imageWrapper.getBoundingClientRect();
            const reference = {
                getBoundingClientRect: () => rect,
                width: imageWrapper.offsetWidth,
                height: imageWrapper.offsetHeight,
            };
            eventCenter.emit('muya-image-selector', {
                block: contentBlock,
                reference,
                imageInfo,
            });
        }
    }
}

export default ImageSelection;
