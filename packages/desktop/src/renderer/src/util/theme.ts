import { THEME_STYLE_ID, COMMON_STYLE_ID, DEFAULT_CODE_FONT_FAMILY } from '../config'
import darkAppearance from '../assets/appearance/dark.css?inline'
import darkSyntax from '../assets/appearance/syntax-dark.css?inline'
import { isLinux } from './index'
const getEmojiPickerPatch = (): string =>
  isLinux
    ? '.mu-emoji-picker section .emoji-wrapper .item span { font-family: sans-serif, "Noto Color Emoji"; }'
    : ''
export const addAppearanceStyle = (appearance: string): void => {
  let sheet = document.querySelector<HTMLStyleElement>(`#${THEME_STYLE_ID}`)
  if (!sheet) {
    sheet = document.createElement('style')
    sheet.id = THEME_STYLE_ID
    document.head.appendChild(sheet)
  }
  const dark = appearance === 'dark'
  sheet.textContent = dark ? `@media not print {${darkAppearance}\n${darkSyntax}}` : ''
  document.body.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelectorAll('.CodeMirror').forEach((cm) => {
    cm.classList.toggle('cm-s-railscasts', dark)
    cm.classList.toggle('cm-s-default', !dark)
  })
}

export const setEditorWidth = (value: string): void => {
  const EDITOR_WIDTH_STYLE_ID = 'editor-width'
  let result = ''
  if (value && /^[0-9]+(?:ch|px|%)$/.test(value)) {
    // Add 100px for the container's horizontal padding. Set both the legacy
    // camelCase var (source mode) and the kebab-case var the active
    // @muyajs/core engine reads for `.mu-container` max-width (issue #4828).
    const width = `calc(100px + ${value})`
    result = `:root { --editorAreaWidth: ${width}; --editor-area-width: ${width}; }`
  }
  let styleEle = document.querySelector(`#${EDITOR_WIDTH_STYLE_ID}`) as HTMLStyleElement | null
  if (!styleEle) {
    styleEle = document.createElement('style')
    styleEle.setAttribute('id', EDITOR_WIDTH_STYLE_ID)
    document.head.appendChild(styleEle)
  }

  styleEle.innerHTML = result
}

export interface CommonStyleOptions {
  codeFontFamily: string
  codeFontSize: number | string
  hideScrollbar?: boolean
  [key: string]: unknown
}

export const addCommonStyle = (options: CommonStyleOptions): void => {
  const { codeFontFamily, codeFontSize, hideScrollbar } = options
  let sheet = document.querySelector(`#${COMMON_STYLE_ID}`) as HTMLStyleElement | null
  if (!sheet) {
    sheet = document.createElement('style')
    sheet.id = COMMON_STYLE_ID
    document.head.appendChild(sheet)
  }

  let scrollbarStyle = ''
  if (hideScrollbar) {
    scrollbarStyle = '::-webkit-scrollbar {display: none;}'
  }

  sheet.innerHTML = `${scrollbarStyle}
.CodeMirror {
font-family: ${codeFontFamily}, ${DEFAULT_CODE_FONT_FAMILY};
font-size: ${codeFontSize}px;
}

${getEmojiPickerPatch()}
`
}

export interface AddStylesOptions extends CommonStyleOptions {
  resolvedAppearance: string
}
export const addStyles = (options: AddStylesOptions): void => {
  addAppearanceStyle(options.resolvedAppearance)
  addCommonStyle(options)
}
