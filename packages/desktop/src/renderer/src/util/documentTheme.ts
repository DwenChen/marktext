import githubLight from 'github-markdown-css/github-markdown-light.css?inline'
import githubDark from 'github-markdown-css/github-markdown-dark.css?inline'
import githubAlerts from '@muyajs/core/assets/styles/githubAlertsExport.css?inline'
import academic from '@/assets/themes/export/academic.theme.css?inline'
import liber from '@/assets/themes/export/liber.theme.css?inline'
import type { CustomDocumentTheme, ResolvedAppearance } from '../../../common/theme'
import { normalizeDocumentTheme } from '../../../common/theme'

const overlays: Record<string, string> = { academic, liber }

// The same CSS drives the live document and every styled export. Appearance
// changes the on-screen palette only; exported documents retain a white page.
export const getDocumentThemeCss = (
  theme: string,
  customThemes: CustomDocumentTheme[] = [],
  appearance: ResolvedAppearance = 'light'
): string => {
  const id = normalizeDocumentTheme(theme, customThemes)
  const overlay = overlays[id] || customThemes.find((item) => item.id === id)?.css || ''
  return (appearance === 'dark' ? githubDark : githubLight) + '\n' + overlay + '\n' + githubAlerts
}

const EDITOR_SCOPE = ':is(.editor-middle .mu-container, .document-theme-preview)'

// Align the table itself, without changing Markdown's per-cell alignment.
export const getTableAlignmentCss = (centerTables = true): string =>
  `.markdown-body table { display: table; margin-inline: ${centerTables ? 'auto' : '0'} !important; max-width: 100%; }`

const splitSelectors = (selectors: string): string[] => {
  const result: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < selectors.length; i++) {
    const char = selectors[i]
    if (quote) {
      if (char === quote && selectors[i - 1] !== '\\') quote = ''
    } else if (char === '"' || char === "'") quote = char
    else if (char === '(' || char === '[') depth++
    else if (char === ')' || char === ']') depth--
    else if (char === ',' && depth === 0) {
      result.push(selectors.slice(start, i))
      start = i + 1
    }
  }
  result.push(selectors.slice(start))
  return result
}

// Scope imported CSS to document content. Even a CSS file using :root/body
// cannot recolour menus, settings or the sidebar. Preserve media/support rules.
export const scopeDocumentCss = (css: string): string => {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  const scope = (rules: CSSRuleList, nested = false): string =>
    Array.from(rules)
      .map((rule) => {
        if (rule instanceof CSSStyleRule) {
          const selectors = splitSelectors(rule.selectorText).map((selector) => {
            // Muya uses spans for editable link labels.
            const trimmed = selector.trim().replace(/(^|[\s>+~,(])a(?=$|[\s>+~.#:[),])/g, '$1:is(a, span.mu-link)')
            if (nested) return trimmed
            if (/\.markdown-body\b/.test(trimmed))
              return trimmed.replace(/\.markdown-body\b/g, EDITOR_SCOPE)
            if (/^(?:html|body|:root)(?=$|\s|[.:#]|\[)/.test(trimmed)) {
              return trimmed.replace(/^(?:(?:html|body|:root)\s*)+/, EDITOR_SCOPE + ' ')
            }
            return EDITOR_SCOPE + ' ' + trimmed
          })
          return selectors.join(',') + '{' + rule.style.cssText + scope(rule.cssRules, true) + '}'
        }
        if (rule instanceof CSSGroupingRule) {
          return (
            rule.cssText.slice(0, rule.cssText.indexOf('{') + 1) +
            scope(rule.cssRules, nested) +
            '}'
          )
        }
        if (
          rule instanceof CSSFontFaceRule ||
          rule instanceof CSSKeyframesRule ||
          rule instanceof CSSLayerStatementRule
        )
          return rule.cssText
        if (nested && rule instanceof CSSNestedDeclarations) return rule.cssText
        return ''
      })
      .join('\n')
  return scope(sheet.cssRules)
}

export const applyDocumentTheme = (
  theme: string,
  customThemes: CustomDocumentTheme[],
  appearance: ResolvedAppearance,
  centerTables = true
): void => {
  let sheet = document.querySelector<HTMLStyleElement>('#document-theme')
  if (!sheet) {
    sheet = document.createElement('style')
    sheet.id = 'document-theme'
    document.head.appendChild(sheet)
  }
  sheet.textContent =
    // Muya's legacy quote marker duplicates the document theme's border.
    // Reset it before applying theme CSS so imported themes can still define
    // their own pseudo-element when they explicitly supply `content`.
    '.editor-middle .mu-container blockquote::before { content: none; }\n' +
    // Normal cell borders belong to the document theme. Keep Muya's overlay
    // for selection only; its edge classes have higher specificity and still
    // paint the outline of a selected rectangle.
    ':where(.editor-middle .mu-container) .mu-table-inner tr :is(th, td)::before { border-color: transparent; }\n' +
    scopeDocumentCss(getDocumentThemeCss(theme, customThemes, appearance)) +
    scopeDocumentCss(getTableAlignmentCss(centerTables)) +
    `
${EDITOR_SCOPE} {
  --document-text: ${appearance === 'dark' ? '#f0f6fc' : '#212121'};
  --document-heading: ${appearance === 'dark' ? '#f0f6fc' : '#282828'};
  --document-code-bg: ${appearance === 'dark' ? '#151b23' : '#f6f8fa'};
  --document-border: ${appearance === 'dark' ? '#3d444d' : '#e5e5e5'};
  --document-quote-border: ${appearance === 'dark' ? '#9198a1' : '#8b929b'};
  --document-rule: ${appearance === 'dark' ? '#3d444d' : '#b0b0b0'};
  --document-table-border: ${appearance === 'dark' ? '#656c76' : '#1a1a1a'};
  --editor-color: ${appearance === 'dark' ? '#f0f6fc' : '#1f2328'};
  --editor-color-80: var(--editor-color);
  --editor-color-50: ${appearance === 'dark' ? '#9198a1' : '#59636e'};
  --link-color: ${appearance === 'dark' ? '#4493f8' : '#0969da'};
  --h1-color: var(--editor-color); --h2-color: var(--editor-color); --h3-color: var(--editor-color);
  --h4-color: var(--editor-color); --h5-color: var(--editor-color); --h6-color: var(--editor-color);
  --strong-color: var(--editor-color); --em-color: var(--editor-color); --list-marker-color: var(--editor-color);
  --blockquote-text-color: var(--editor-color-50);
  --blockquote-border-color: var(--document-border);
}
/* Preserve the editing column and Muya controls while adopting document CSS. */
.editor-middle .mu-container { margin: 0 auto; background: transparent; overflow: visible; }
.editor-middle .mu-container > :first-child { margin-top: 0; }
.editor-middle .mu-container pre.mu-code-block { padding: 0; }
.editor-middle .mu-container pre.mu-code-block > code.mu-code { display: block; padding: 16px; }
.editor-middle .mu-container pre.mu-code-block:has(.mu-line-numbers-rows) > code.mu-code { padding-left: 3.8em; }
.editor-middle .mu-container .mu-code-block .mu-line-numbers-rows { top: 16px; }
.editor-middle .mu-container .mu-tight-list > li > p { margin: 0; }
.editor-middle .mu-container .mu-thematic-break::before {
  display: block;
  height: 0;
  border-top: 1px solid var(--document-rule);
  content: '';
}
.editor-middle .mu-container .mu-thematic-break.mu-active::before {
  top: auto;
  bottom: 0;
  transform: none;
}
`
}
