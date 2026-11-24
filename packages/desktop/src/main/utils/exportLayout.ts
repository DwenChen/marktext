export interface ExportLayoutOptions {
  mode: 'pdf' | 'png'
  pageWidthPx: number
  pageHeightPx?: number
}

/**
 * Build a self-contained browser script executed inside an isolated offscreen
 * export window (after load, before PDF printing or PNG capture).
 *
 * It waits for web fonts (notably embedded KaTeX WOFF2 fonts) and images so
 * math formulas and media never vanish due to FOIT/load races, then applies
 * non-destructive layout fitting for complex elements:
 * - Scales oversized diagrams (Mermaid, Flowchart, Sequence, Vega, PlantUML)
 *   and standalone images proportionally so they fit within page bounds
 *   alongside any preceding heading without blank pages or slicing.
 * - Keeps multi-column tables legible and within container width without
 *   chopping numbers/identifiers mid-token or triggering page-wide shrink.
 * - Prevents awkward mid-line wrapping of ASCII box-drawing diagrams and
 *   keeps short code blocks intact across PDF page breaks.
 * - Fits wide KaTeX display formulas inside container bounds without clipping.
 * - Allows tall alerts/blockquotes/table rows to break cleanly so they never
 *   create blank half-pages.
 */
export const buildExportLayoutScript = (options: ExportLayoutOptions): string => {
  const serialized = JSON.stringify({
    mode: options.mode,
    pageWidthPx: Math.max(200, Math.round(options.pageWidthPx)),
    pageHeightPx: options.pageHeightPx ? Math.max(200, Math.round(options.pageHeightPx)) : 0
  })

  return `(async (opts) => {
    const raf = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready.catch(() => {});
    }

    await Promise.all(
      Array.from(document.images, (img) => {
        if (img.complete) {
          return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
        }
        return new Promise((resolve) => {
          const done = () => {
            if (typeof img.decode === 'function') {
              img.decode().catch(() => {}).finally(resolve);
            } else {
              resolve();
            }
          };
          const timer = setTimeout(resolve, 10000);
          img.addEventListener('load', () => { clearTimeout(timer); done(); }, { once: true });
          img.addEventListener('error', () => { clearTimeout(timer); resolve(); }, { once: true });
        });
      })
    );

    await raf();

    const article = document.querySelector('article.markdown-body');
    if (!article) {
      await raf();
      return;
    }

    const articleStyle = getComputedStyle(article);
    const padX =
      (parseFloat(articleStyle.paddingLeft) || 0) +
      (parseFloat(articleStyle.paddingRight) || 0);
    const measuredWidth = Math.floor(article.getBoundingClientRect().width - padX);
    const contentWidth = Math.max(200, measuredWidth || opts.pageWidthPx);

    let effectivePageHeight = opts.pageHeightPx || 0;
    if (opts.mode === 'pdf' && effectivePageHeight > 0) {
      const headerEl = document.querySelector('.page-header .hf-container');
      const footerEl = document.querySelector('.page-footer .hf-container');
      const headerH = headerEl ? Math.ceil(headerEl.getBoundingClientRect().height + 20) : 0;
      const footerH = footerEl ? Math.ceil(footerEl.getBoundingClientRect().height + 20) : 0;
      effectivePageHeight = Math.max(240, effectivePageHeight - headerH - footerH);
    }

    const getPrecedingHeadingReserve = (el) => {
      let prev = el.previousElementSibling;
      while (prev && prev.tagName === 'BR') prev = prev.previousElementSibling;
      if (prev && /^H[1-6]$/.test(prev.tagName)) {
        const rect = prev.getBoundingClientRect();
        return Math.min(110, Math.ceil(rect.height + 28));
      }
      return 0;
    };

    const getSvgNaturalSize = (svg) => {
      const vb = svg.viewBox && svg.viewBox.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) {
        return { width: vb.width, height: vb.height };
      }
      const attrW = parseFloat(svg.getAttribute('width') || '');
      const attrH = parseFloat(svg.getAttribute('height') || '');
      if (Number.isFinite(attrW) && attrW > 0 && Number.isFinite(attrH) && attrH > 0) {
        return { width: attrW, height: attrH };
      }
      const rect = svg.getBoundingClientRect();
      return {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height)
      };
    };

    // 1. Fit diagrams (Mermaid, Flowchart, Sequence, Vega, PlantUML) proportionally.
    const diagramContainers = article.querySelectorAll(
      'div.mermaid, div.flowchart, div.sequence, div.vega-lite, div.vega-embed, div.plantuml'
    );
    for (const container of diagramContainers) {
      const svg = container.querySelector('svg');
      const img = !svg ? container.querySelector('img') : null;
      const graphic = svg || img;
      if (!graphic) continue;

      let natW = 0;
      let natH = 0;
      if (svg) {
        const size = getSvgNaturalSize(svg);
        natW = size.width;
        natH = size.height;
        if (!svg.getAttribute('viewBox') && natW > 0 && natH > 0) {
          svg.setAttribute('viewBox', '0 0 ' + natW + ' ' + natH);
        }
        if (!svg.getAttribute('preserveAspectRatio')) {
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        }
      } else if (img) {
        natW = img.naturalWidth || img.getBoundingClientRect().width;
        natH = img.naturalHeight || img.getBoundingClientRect().height;
      }

      if (natW <= 0 || natH <= 0) continue;

      const cStyle = getComputedStyle(container);
      const padY =
        (parseFloat(cStyle.paddingTop) || 0) + (parseFloat(cStyle.paddingBottom) || 0);
      const headingReserve = opts.mode === 'pdf' ? getPrecedingHeadingReserve(container) : 0;

      let scale = Math.min(1, contentWidth / natW);
      if (opts.mode === 'pdf' && effectivePageHeight > 0) {
        const maxH = Math.max(180, effectivePageHeight * 0.90 - padY - headingReserve);
        scale = Math.min(scale, maxH / natH);
      }

      const targetW = Math.max(1, Math.floor(natW * scale));
      const targetH = Math.max(1, Math.floor(natH * scale));
      graphic.style.width = targetW + 'px';
      graphic.style.height = targetH + 'px';
      graphic.style.maxWidth = '100%';
      graphic.style.display = 'block';
      graphic.style.margin = '0 auto';

      if (opts.mode === 'pdf') {
        container.style.breakInside = 'avoid';
        container.style.pageBreakInside = 'avoid';
      }
    }

    // 2. Fit tall standalone images cleanly in PDF so they never slice across pages.
    if (opts.mode === 'pdf' && effectivePageHeight > 0) {
      const images = article.querySelectorAll('img');
      for (const img of images) {
        if (img.closest('div.mermaid, div.flowchart, div.sequence, div.vega-lite, div.vega-embed, div.plantuml')) {
          continue;
        }
        const host = img.closest('p, figure') || img;
        const headingReserve = getPrecedingHeadingReserve(host);
        const maxH = Math.max(180, effectivePageHeight * 0.88 - headingReserve);
        const rect = img.getBoundingClientRect();
        if (rect.height > maxH && rect.width > 0) {
          img.style.maxHeight = Math.floor(maxH) + 'px';
          img.style.width = 'auto';
          img.style.height = 'auto';
          img.style.maxWidth = '100%';
        }
      }
    }

    // 3. Optimize tables for readability, width fit, and clean pagination.
    const tables = article.querySelectorAll('table');
    const baseArticleFs = parseFloat(articleStyle.fontSize) || 16;
    for (const table of tables) {
      if (table.classList.contains('page-container')) continue;
      table.style.maxWidth = '100%';
      table.style.borderCollapse = 'collapse';

      const rows = Array.from(table.querySelectorAll('tr'));
      let colCount = 0;
      for (const row of rows) {
        const count = row.querySelectorAll('th, td').length;
        if (count > colCount) colCount = count;
      }

      const cells = Array.from(table.querySelectorAll('th, td'));
      if (colCount >= 8) {
        for (const cell of cells) {
          cell.style.padding = opts.mode === 'pdf' ? '4px 5px' : '5px 7px';
        }
      } else if (colCount >= 6) {
        for (const cell of cells) {
          cell.style.padding = opts.mode === 'pdf' ? '5px 6px' : '5px 8px';
        }
      }

      // Reduce font size gently for dense multi-column tables or overflowing tables
      // so numeric/short columns stay on one line and the table fits inside contentWidth.
      const minFs = opts.mode === 'pdf' ? 9.5 : 11;
      const startScale =
        opts.mode === 'pdf'
          ? colCount >= 8
            ? 0.78
            : colCount >= 6
              ? 0.86
              : 1
          : colCount >= 8
            ? 0.86
            : colCount >= 6
              ? 0.92
              : 1;

      if (startScale < 1) {
        table.style.fontSize = Math.max(minFs, baseArticleFs * startScale).toFixed(2) + 'px';
      }

      const stepScales = [0.88, 0.82, 0.76, 0.70, 0.65];
      for (const factor of stepScales) {
        if (table.scrollWidth <= contentWidth + 1) break;
        const candidate = Math.max(minFs, baseArticleFs * factor);
        const current = parseFloat(getComputedStyle(table).fontSize) || baseArticleFs;
        if (candidate < current - 0.1) {
          table.style.fontSize = candidate.toFixed(2) + 'px';
        }
      }

      // If a table still overflows (e.g. a very long unbroken identifier/URL),
      // allow breaking long tokens inside cells so it never triggers whole-page shrink.
      if (table.scrollWidth > contentWidth + 1) {
        table.style.width = '100%';
        for (const cell of cells) {
          if (cell.textContent && cell.textContent.trim().length > 16) {
            cell.style.overflowWrap = 'anywhere';
          }
        }
      }
      if (table.scrollWidth > contentWidth + 1) {
        for (const cell of cells) {
          cell.style.overflowWrap = 'anywhere';
        }
      }

      // Keep normal rows intact across PDF page breaks, but allow unusually tall
      // single rows (> 75% of page height) to break so they never leave blank pages.
      if (opts.mode === 'pdf' && effectivePageHeight > 0) {
        const bodyRows = table.querySelectorAll('tbody tr');
        for (const row of bodyRows) {
          const rowH = row.getBoundingClientRect().height;
          if (rowH > effectivePageHeight * 0.75) {
            row.style.breakInside = 'auto';
            row.style.pageBreakInside = 'auto';
          } else {
            row.style.breakInside = 'avoid';
            row.style.pageBreakInside = 'avoid';
          }
        }
      }
    }

    // 4. Optimize code blocks & ASCII diagrams.
    const boxDrawingRe = /[┌┐└┘│─►├┤┬┴┼═║╔╗╚╝▼▲◄]/;
    const pres = article.querySelectorAll('pre');
    for (const pre of pres) {
      if (getComputedStyle(pre).display === 'none') continue;
      const code = pre.querySelector('code') || pre;
      const text = code.textContent || '';
      const hasBoxDrawing = boxDrawingRe.test(text);

      // Measure natural unwrapped width.
      const prevPreWhiteSpace = pre.style.whiteSpace;
      const prevCodeWhiteSpace = code.style.whiteSpace;
      const prevOverflow = pre.style.overflow;
      pre.style.overflow = 'auto';
      pre.style.whiteSpace = 'pre';
      code.style.whiteSpace = 'pre';

      const preStyle = getComputedStyle(pre);
      const codeStyle = getComputedStyle(code);
      const baseCodeFs = parseFloat(codeStyle.fontSize) || 13.6;
      const prePadX =
        (parseFloat(preStyle.paddingLeft) || 0) + (parseFloat(preStyle.paddingRight) || 0);
      const innerAvailable = Math.max(160, contentWidth - prePadX - 4);
      const innerScrollWidth = Math.max(0, pre.scrollWidth - prePadX);

      if (innerScrollWidth > innerAvailable) {
        const ratio = innerScrollWidth / innerAvailable;
        if (hasBoxDrawing) {
          // Keep ASCII diagrams aligned on single lines down to a crisp floor.
          const minAsciiFs = opts.mode === 'pdf' ? 8.5 : 10;
          const fitted = Math.max(minAsciiFs, baseCodeFs * (innerAvailable / innerScrollWidth));
          code.style.fontSize = fitted.toFixed(2) + 'px';
        } else if (ratio <= 1.28) {
          // Gently tighten font size so 80-100 char code lines don't wrap by a few chars.
          const minCodeFs = opts.mode === 'pdf' ? 10.2 : 11.5;
          const fitted = Math.max(minCodeFs, baseCodeFs * (innerAvailable / innerScrollWidth));
          code.style.fontSize = fitted.toFixed(2) + 'px';
        }
      }

      pre.style.overflow = 'visible';
      pre.style.whiteSpace = prevPreWhiteSpace || 'pre-wrap';
      code.style.whiteSpace = prevCodeWhiteSpace || 'pre-wrap';
      code.style.overflowWrap = 'break-word';

      if (opts.mode === 'pdf' && effectivePageHeight > 0) {
        const h = pre.getBoundingClientRect().height;
        if (h <= effectivePageHeight * 0.45) {
          pre.style.breakInside = 'avoid';
          pre.style.pageBreakInside = 'avoid';
        } else {
          pre.style.breakInside = 'auto';
          pre.style.pageBreakInside = 'auto';
        }
      }
    }

    // 5. Fit wide KaTeX display formulas cleanly within container width.
    const katexDisplays = article.querySelectorAll('.katex-display');
    for (const block of katexDisplays) {
      const katexEl = block.querySelector('.katex');
      if (!katexEl) continue;
      const w = katexEl.scrollWidth;
      if (w > contentWidth - 4) {
        const currentFs = parseFloat(getComputedStyle(katexEl).fontSize) || 19.36;
        const factor = Math.max(0.62, (contentWidth - 8) / w);
        katexEl.style.fontSize = (currentFs * factor).toFixed(2) + 'px';
      }
    }

    // 6. Keep short GitHub alerts & blockquotes together, allow tall ones to flow cleanly.
    if (opts.mode === 'pdf' && effectivePageHeight > 0) {
      const callouts = article.querySelectorAll('.markdown-alert, blockquote');
      for (const el of callouts) {
        const h = el.getBoundingClientRect().height;
        if (h <= effectivePageHeight * 0.50) {
          el.style.breakInside = 'avoid';
          el.style.pageBreakInside = 'avoid';
        } else {
          el.style.breakInside = 'auto';
          el.style.pageBreakInside = 'auto';
        }
      }
    }

    await raf();
    await raf();
  })(${serialized})`
}
