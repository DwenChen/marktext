export class TextDropIndicator {
    private _element: HTMLDivElement;

    constructor(private _root: HTMLElement) {
        this._element = document.createElement('div');
        this._element.className = 'mu-text-drop-indicator';
        this._element.contentEditable = 'false';
        this._element.setAttribute('aria-hidden', 'true');
    }

    show(rect: DOMRect, kind: 'item' | 'text', after = false): void {
        if (!this._element.isConnected)
            this._root.appendChild(this._element);
        this._element.dataset.kind = kind;
        Object.assign(this._element.style, { left: '0px', top: '0px', width: '1px', height: '1px' });
        // Transformed editor ancestors give fixed descendants their own viewport origin and scale.
        const origin = this._element.getBoundingClientRect();
        const scaleX = origin.width || 1;
        const scaleY = origin.height || 1;
        Object.assign(this._element.style, {
            left: `${(rect.left - origin.left) / scaleX}px`,
            top: `${((kind === 'item' ? (after ? rect.bottom : rect.top) - 1.5 : rect.top) - origin.top) / scaleY}px`,
            width: `${(kind === 'item' ? rect.width : 2) / scaleX}px`,
            height: `${(kind === 'item' ? 3 : rect.height) / scaleY}px`,
        });
    }

    hide(): void {
        this._element.remove();
    }
}
