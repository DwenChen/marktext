import type { TState } from './types';
import { deepClone } from '../utils';

interface ICacheEntry {
    state: TState[];
    bytes: number;
}

/** Parsed documents only: no DOM, selection, or history is retained. */
export class MarkdownStateCache {
    private _entries = new Map<string, ICacheEntry>();
    private _bytes = 0;

    constructor(private _maxBytes = 8 * 1024 * 1024, private _maxEntries = 3) {}

    get(key: string): TState[] | undefined {
        const entry = this._entries.get(key);
        if (!entry)
            return undefined;
        this._entries.delete(key);
        this._entries.set(key, entry);
        // Block constructors retain and edit metadata from their input state.
        return deepClone(entry.state);
    }

    set(key: string, state: TState[]) {
        const previous = this._entries.get(key);
        if (previous) {
            this._bytes -= previous.bytes;
            this._entries.delete(key);
        }
        const bytes = 2 * (key.length + JSON.stringify(state).length);
        if (bytes > this._maxBytes)
            return;
        while (this._entries.size && (this._bytes + bytes > this._maxBytes || this._entries.size >= this._maxEntries)) {
            const oldest = this._entries.keys().next().value!;
            this._bytes -= this._entries.get(oldest)!.bytes;
            this._entries.delete(oldest);
        }
        this._entries.set(key, { state: deepClone(state), bytes });
        this._bytes += bytes;
    }

    clear() {
        this._entries.clear();
        this._bytes = 0;
    }
}
