// Muya can change trailing newlines during an edit/undo round trip; save options
// govern those bytes separately. Two 32-bit limbs avoid a BigInt per character.
export const contentSignature = (content: string): string => {
  let end = content.length
  while (end > 0 && (content.charCodeAt(end - 1) === 10 || content.charCodeAt(end - 1) === 13))
    end--
  let high = 0xcbf29ce4
  let low = 0x84222325
  for (let i = 0; i < end; i++) {
    low = (low ^ content.charCodeAt(i)) >>> 0
    const product = low * 0x1b3
    high =
      (Math.imul(high, 0x1b3) + Math.imul(low, 0x100) + Math.floor(product / 0x100000000)) >>> 0
    low = product >>> 0
  }
  return high.toString(16).padStart(8, '0') + low.toString(16).padStart(8, '0')
}
