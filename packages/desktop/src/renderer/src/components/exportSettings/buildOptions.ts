export interface DocumentExportFeatures {
  hasHeadings: boolean
  hasFrontMatter: boolean
  hasToc: boolean
  hasBodyToc: boolean
}

// Persist all settings, but send only options that apply to this format and
// document. In particular, saved PDF headers/fonts must not leak into HTML/PNG.
export const buildExportOptions = (
  type: string,
  settings: Record<string, unknown>,
  features: DocumentExportFeatures
): Record<string, unknown> => {
  const options: Record<string, unknown> = { type }
  const copy = (...keys: string[]) => {
    for (const key of keys) options[key] = settings[key]
  }
  if (features.hasHeadings) copy('autoNumberingHeadings')
  if (features.hasFrontMatter) copy('showFrontMatter')
  if (features.hasToc) copy('tocTitle', 'tocIncludeTopHeading')
  if (features.hasBodyToc) copy('showBodyToc')
  if (type === 'styledHtml') copy('htmlTitle')
  if (type === 'png') copy('imageWidth')
  if (type === 'pdf') {
    copy('pageSize', 'isLandscape')
    if (settings.pageSize === 'custom') copy('pageSizeWidth', 'pageSizeHeight')
  }
  if (type === 'pdf' || type === 'print') {
    copy('pageMarginTop', 'pageMarginRight', 'pageMarginBottom', 'pageMarginLeft')
    if (settings.fontSettingsOverwrite) {
      copy('fontSize', 'lineHeight')
      options.fontFamily = settings.fontFamily === 'Default' ? null : settings.fontFamily
    }
    for (const part of ['header', 'footer']) {
      const partType = settings[`${part}Type`]
      if (partType === 1 || partType === 2) {
        options[part] = {
          type: partType,
          left: partType === 2 ? settings[`${part}TextLeft`] : '',
          center: settings[`${part}TextCenter`],
          right: partType === 2 ? settings[`${part}TextRight`] : ''
        }
      }
    }
    if ((options.header || options.footer) && settings.headerFooterCustomize) {
      copy('headerFooterStyled', 'headerFooterFontSize')
    }
  }
  return options
}
