import { contentSignature } from 'common/contentSignature'

export interface IFileHistoryLike {
  stack: Array<{ id: number | string; [key: string]: unknown }>
  index: number
  lastEditIndex: number
  lastInitIndex: number
}

// The desktop history shape differs from Muya's OT history. IDs remain useful
// to legacy consumers; save receipts use the content signature across modes.
export class SyntheticHistory {
  private counter = 0
  private readonly baseline: string
  private readonly idByContent = new Map<string, number>()

  constructor(baselineContent: string = '') {
    this.baseline = contentSignature(baselineContent)
    this.idByContent.set(this.baseline, 0)
  }

  private idForSignature(key: string): number {
    if (key === this.baseline) return 0
    let id = this.idByContent.get(key)
    if (id === undefined) id = ++this.counter
    this.idByContent.delete(key)
    this.idByContent.set(key, id)
    // Retain more signatures than Muya's 100 undo entries, with a pinned baseline.
    if (this.idByContent.size > 256) {
      const oldest = this.idByContent.keys().next().value
      if (oldest !== undefined) this.idByContent.delete(oldest)
    }
    return id
  }

  idFor(content: string): number {
    return this.idForSignature(contentSignature(content))
  }

  build(content: string): IFileHistoryLike {
    const signature = contentSignature(content)
    return {
      stack: [{ id: this.idForSignature(signature), contentSignature: signature }],
      index: 0,
      lastEditIndex: 0,
      lastInitIndex: -1
    }
  }
}
