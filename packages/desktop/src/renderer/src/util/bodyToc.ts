const TOC_LABEL = /^(?:目录|目次|table\s+of\s+contents|contents|toc)$/i

const isTocMarker = (element: Element): boolean =>
  element.tagName === 'P' &&
  element.children.length === 0 &&
  /^\[toc\]$/i.test(element.textContent?.trim() || '')

const isTocList = (element: Element): boolean => {
  if (!['UL', 'OL'].includes(element.tagName)) return false
  const items = Array.from(element.querySelectorAll('li'))
  if (!items.length) return false
  return items.every((item) => {
    const content = item.cloneNode(true) as Element
    content.querySelectorAll('ul,ol').forEach((list) => list.remove())
    const links = Array.from(content.querySelectorAll('a'))
    if (!links.length || links.some((link) => !/^#.+/.test(link.getAttribute('href') || ''))) {
      return false
    }
    links.forEach((link) => link.remove())
    return !content.textContent?.trim() && !content.querySelector('img,input,pre,code,table')
  })
}

// Only document-level labels followed by anchor lists qualify. A chapter about
// directories, quoted examples, and navigation links elsewhere are ordinary body text.
export const findBodyToc = (root: Element): { nodes: Element[]; markers: Element[] } => {
  const nodes = new Set<Element>()
  const markers: Element[] = []
  for (const element of Array.from(root.children)) {
    if (isTocMarker(element)) {
      nodes.add(element)
      markers.push(element)
      continue
    }
    if (
      !/^(?:H[1-6]|P)$/.test(element.tagName) ||
      element.querySelector('code,a,img') ||
      !TOC_LABEL.test(element.textContent?.trim() || '')
    ) {
      continue
    }
    const contents: Element[] = []
    let next = element.nextElementSibling
    while (next && (isTocList(next) || isTocMarker(next))) {
      contents.push(next)
      next = next.nextElementSibling
    }
    if (contents.length) {
      nodes.add(element)
      contents.forEach((content) => nodes.add(content))
    }
  }
  return { nodes: Array.from(nodes), markers }
}
