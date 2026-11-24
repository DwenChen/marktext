import { resolveLocalImageSrc } from '../util/resolveImageSrc'

class MarkdownPrint {
  private container: HTMLElement | null = null

  /**
   * Prepare document export and append a hidden print container to the window.
   * Everything outside of this hidden print container will be hidden with display: none.
   *
   * @param html HTML string
   * @param renderStatic Render for static files like PDF documents
   * @param dir Text direction to mirror onto the container. `innerHTML` drops
   *   the exporter's outer `<html dir=…>` shell and the container is a sibling
   *   of `.editor-wrapper`, so RTL documents print LTR unless we set it here
   *   (#4833). LTR is the default and stays implicit.
   */
  renderMarkdown(html: string, renderStatic?: boolean, dir?: string): void {
    this.clearup()
    const printContainer = document.createElement('article')
    printContainer.classList.add('print-container')
    if (dir === 'rtl' || dir === 'auto') {
      printContainer.setAttribute('dir', dir)
    }
    this.container = printContainer
    printContainer.innerHTML = html

    // Fix images when rendering for static files like PDF (GH#678).
    if (renderStatic) {
      // Traverse through the DOM tree and fix all relative image sources.
      const images = printContainer.getElementsByTagName('img')
      for (const image of Array.from(images)) {
        const rawSrc = image.getAttribute('src') ?? ''
        image.src = resolveLocalImageSrc(rawSrc)
      }
    }

    document.body.appendChild(printContainer)
  }

  /**
   * Wait until embedded web fonts (such as KaTeX WOFF2 fonts) and images inside
   * the print container are ready before invoking native printing.
   */
  async waitForReady(): Promise<void> {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {})
    }
    if (this.container) {
      const images = Array.from(this.container.getElementsByTagName('img'))
      await Promise.all(
        images.map((img) => {
          if (img.complete) {
            return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()
          }
          return new Promise<void>((resolve) => {
            const timer = setTimeout(resolve, 10000)
            img.addEventListener(
              'load',
              () => {
                clearTimeout(timer)
                if (typeof img.decode === 'function') {
                  img.decode().catch(() => {}).finally(resolve)
                } else {
                  resolve()
                }
              },
              { once: true }
            )
            img.addEventListener(
              'error',
              () => {
                clearTimeout(timer)
                resolve()
              },
              { once: true }
            )
          })
        })
      )
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }

  /**
   * Remove the print container from the window.
   */
  clearup(): void {
    if (this.container) {
      this.container.remove()
    }
  }
}

export default MarkdownPrint
