// @vitest-environment happy-dom
import type { Nullable } from '../../../../types';

import type { ILinkedNode } from '../linkedNode';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';
import Paragraph from '../../../commonMark/paragraph';
import { LinkedList } from '../linkedList';

interface IMockNode extends ILinkedNode {
    value: number;
}

function createLinkedNode(): IMockNode {
    const value = Math.random();

    return {
        value,
        prev: null,
        next: null,
    };
}

describe('test LinkedList', () => {
    let linkedList: Nullable<LinkedList<IMockNode>> = null;

    beforeEach(() => {
        linkedList = new LinkedList();
    });

    afterEach(() => {
        linkedList = null;
    });

    describe('basic use of append', () => {
        it('should append a node and the length is 1', () => {
            const node1 = createLinkedNode();

            expect(linkedList).not.toBeNull();

            linkedList?.append(node1);

            expect(linkedList?.length).toBe(1);
            expect(linkedList?.head).toEqual(node1);
            expect(linkedList?.tail).toEqual(node1);
        });
    });

    describe('basic use of method append', () => {
        it('should append two nodes and the length is 2', () => {
            const node2 = createLinkedNode();
            const node3 = createLinkedNode();
            linkedList?.append(node2, node3);

            expect(linkedList?.length).toBe(2);
            expect(linkedList?.head).toEqual(node2);
            expect(linkedList?.tail).toEqual(node3);
        });
    });

    describe('basic use of method insertBefore', () => {
        it('should work correctly when insert some nodes', () => {
            const node1 = createLinkedNode();
            const node2 = createLinkedNode();
            const node3 = createLinkedNode();
            linkedList?.insertBefore(node1);

            expect(node1.prev).toBe(null);
            expect(node1.next).toBe(null);
            expect(linkedList?.head).toEqual(node1);
            expect(linkedList?.tail).toEqual(node1);
            linkedList?.insertBefore(node2, node1);
            expect(node2.next).toBe(node1);
            expect(node1.prev).toBe(node2);
            expect(linkedList?.head).toEqual(node2);
            expect(linkedList?.tail).toEqual(node1);
            linkedList?.insertBefore(node3);
            expect(node3.prev).toBe(node1);
            expect(node1.next).toBe(node3);
            expect(linkedList?.tail).toBe(node3);
            expect(linkedList?.length).toBe(3);
        });
    });

    describe('linkedList method `contains`', () => {
        it('should work correctly in LinkedList method `contains`', () => {
            const node = createLinkedNode();
            linkedList?.insertBefore(node);

            expect(linkedList?.contains(node)).toBeTruthy();
        });
    });

    describe('linkedList method `offset`', () => {
        it('should work correctly in LinkedList method `offset`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
                expect(linkedList?.offset(nodes[`node${i}`])).toBe(i);
            }

            const isolatedNode = createLinkedNode();
            expect(linkedList?.offset(isolatedNode)).toBe(-1);
        });

        it('finds the first, middle and last node in a large list', () => {
            const nodes = Array.from({ length: 10001 }, createLinkedNode);
            linkedList!.append(...nodes);
            for (const index of [0, 5000, 10000]) {
                expect(linkedList!.offset(nodes[index])).toBe(index);
                expect(linkedList!.find(index)).toBe(nodes[index]);
            }
        });

        it('keeps node indexes aligned after insertion, removal and moving between lists', () => {
            const [first, middle, last, inserted] = Array.from({ length: 4 }, createLinkedNode);
            linkedList!.append(first, middle, last);
            const assertIndexes = (expected: IMockNode[]) => {
                expect([...linkedList!.iterator()]).toEqual(expected);
                expected.forEach((node, index) => {
                    expect(linkedList!.offset(node)).toBe(index);
                    expect(linkedList!.find(index)).toBe(node);
                });
            };
            linkedList!.insertBefore(inserted, middle);
            assertIndexes([first, inserted, middle, last]);
            linkedList!.remove(middle);
            expect(linkedList!.offset(middle)).toBe(-1);
            assertIndexes([first, inserted, last]);
            linkedList!.remove(last);
            linkedList!.insertBefore(last, first);
            assertIndexes([last, first, inserted]);
            const destination = new LinkedList<IMockNode>();
            linkedList!.remove(first);
            destination.append(first);
            assertIndexes([last, inserted]);
            expect(destination.find(0)).toBe(first);
            expect(destination.offset(first)).toBe(0);
            destination.remove(first);
            linkedList!.append(first);
            assertIndexes([last, inserted, first]);
        });
    });

    describe('linkedList method `remove`', () => {
        it('should work correctly in LinkedList method `remove`', () => {
            const node = createLinkedNode();
            linkedList?.append(node);
            expect(linkedList?.contains(node)).toBeTruthy();
            linkedList?.remove(node);
            expect(linkedList?.contains(node)).toBeFalsy();
        });
    });

    describe('linkedList method `find`', () => {
        it('should work correctly in LinkedList method `find`', () => {
            const node = createLinkedNode();
            linkedList?.append(node);
            expect(linkedList?.find(0)).toBe(node);
            expect(linkedList?.find(1)).toBeFalsy();
        });

        it('preserves null for out-of-range indexes and undefined for non-integer array keys', () => {
            linkedList!.append(createLinkedNode(), createLinkedNode(), createLinkedNode());
            for (const index of [-1, -0.5, 3, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY])
                expect(linkedList!.find(index)).toBeNull();
            for (const index of [0.5, 1.5, Number.NaN])
                expect(linkedList!.find(index)).toBeUndefined();
            const empty = new LinkedList<IMockNode>();
            expect(empty.find(0)).toBeNull();
            expect(empty.find(Number.NaN)).toBeUndefined();
        });
    });

    describe('linkedList method `forEach`', () => {
        it('should work correctly in LinkedList method `forEach`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }
            linkedList?.forEach((node, i) => {
                expect(nodes[`node${i}`]).toBe(node);
            });
        });
    });

    describe('linkedList method `forEachAt`', () => {
        it('should work correctly in LinkedList method `forEachAt`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }
            let count = 0;
            linkedList?.forEachAt(1, 2, (node, i) => {
                count++;
                expect(nodes[`node${i}`]).toBe(node);
            });
            expect(count).toBe(2);
        });
    });

    describe('linkedList method `map`', () => {
        it('should work correctly in LinkedList method `map`', () => {
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }

            const array = linkedList?.map((_node, i) => i);
            expect(linkedList?.length).toEqual(array?.length);
        });
    });

    describe('linkedList method `reduce`', () => {
        it('should work correctly in LinkedList method `reduce`', () => {
            const anotherLinkedList = new LinkedList();
            const nodes: Record<string, IMockNode> = {};
            for (const i of [...Array.from({ length: 5 })].map((_, index) => index)) {
                nodes[`node${i}`] = createLinkedNode();
                linkedList?.insertBefore(nodes[`node${i}`]);
            }
            linkedList?.reduce((_acc, node, _i) => {
                anotherLinkedList.insertBefore(node);

                return anotherLinkedList;
            }, anotherLinkedList);

            for (const node of linkedList!.iterator())
                linkedList?.remove(node);

            expect(anotherLinkedList.length).toBe(5);
            expect(linkedList?.length).toBe(0);
        });
    });
});

describe('block paths through structural history', () => {
    let muya: Muya;
    beforeEach(() => {
        window.MUYA_VERSION = 'test';
        const host = document.createElement('div');
        document.body.appendChild(host);
        muya = new Muya(host, { markdown: 'first\n\nmiddle\n\nlast' });
        muya.init();
    });
    afterEach(() => {
        muya.destroy();
        muya.domNode.remove();
        delete (window as Partial<Window>).MUYA_VERSION;
    });

    function assertPaths(expected: string[]) {
        const page = muya.editor.scrollPage!;
        const blocks = [...page.children.iterator()];
        expect(blocks).toHaveLength(expected.length);
        blocks.forEach((block, index) => {
            if (!block.isParent())
                throw new Error('Expected a paragraph block');
            expect(block.path).toEqual([index]);
            expect(page.children.find(index)).toBe(block);
            const leaf = block.firstContentInDescendant()!;
            expect(leaf.path).toEqual([index, 'text']);
            expect(page.queryBlock([...leaf.path])).toBe(leaf);
            expect(leaf.text).toBe(expected[index]);
        });
    }

    it.each([0, 1, 2])('resolves paths after inserting at %i, undoing, removing and moving blocks', (index) => {
        const page = muya.editor.scrollPage!;
        const initial = ['first', 'middle', 'last'];
        const target = page.children.find(index)!;
        if (!target.isParent())
            throw new Error('Expected a paragraph block');
        const inserted = Paragraph.create(muya, { name: 'paragraph', text: 'inserted' });
        page.insertBefore(inserted, target);
        muya.flush();
        const expected = [...initial];
        expected.splice(index, 0, 'inserted');
        assertPaths(expected);
        muya.undo();
        assertPaths(initial);
        muya.redo();
        assertPaths(expected);

        muya.editor.history.cutoff();
        page.children.find(index)!.remove();
        muya.flush();
        assertPaths(initial);
        muya.undo();
        assertPaths(expected);
        muya.redo();
        assertPaths(initial);

        muya.editor.history.cutoff();
        const last = page.children.find(2)!;
        const first = page.children.find(0)!;
        if (!first.isParent())
            throw new Error('Expected a paragraph block');
        last.insertInto(page, first);
        muya.flush();
        assertPaths(['last', 'first', 'middle']);
        muya.undo();
        assertPaths(initial);
        muya.redo();
        assertPaths(['last', 'first', 'middle']);
    });
});
