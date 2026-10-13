import { describe, it, expect } from 'vitest'
import { buildExportOptions } from '@/components/exportSettings/buildOptions'

const saved = {
  htmlTitle: 'Document', imageWidth: 1600, pageSize: 'A4', pageSizeWidth: 200,
  pageSizeHeight: 300, isLandscape: true, pageMarginTop: 20, pageMarginRight: 15,
  pageMarginBottom: 20, pageMarginLeft: 15, fontSettingsOverwrite: true,
  fontFamily: 'Georgia', fontSize: 18, lineHeight: 1.5,
  headerType: 1, headerTextLeft: 'Old left', headerTextCenter: 'Title', headerTextRight: 'Old right',
  footerType: 2, footerTextLeft: 'Left', footerTextCenter: 'Page', footerTextRight: 'Right',
  headerFooterCustomize: true, headerFooterStyled: true, headerFooterFontSize: 10,
  autoNumberingHeadings: true, showFrontMatter: true, tocTitle: 'Contents', tocIncludeTopHeading: false,
  showBodyToc: false
}
const noFeatures = { hasHeadings: false, hasToc: false, hasBodyToc: false, hasFrontMatter: false }

describe('format-specific export settings', () => {
  it('saved print options do not affect HTML or PNG', () => {
    expect(buildExportOptions('styledHtml', saved, noFeatures)).toEqual({ type: 'styledHtml', htmlTitle: 'Document' })
    expect(buildExportOptions('png', saved, noFeatures)).toEqual({ type: 'png', imageWidth: 1600 })
  })
  it('standard PDF paper excludes stale custom dimensions and image settings', () => {
    const options = buildExportOptions('pdf', saved, noFeatures)
    expect(options).toMatchObject({ pageSize: 'A4', isLandscape: true, pageMarginTop: 20, fontFamily: 'Georgia', header: { type: 1, left: '', center: 'Title', right: '' } })
    expect(options).not.toHaveProperty('pageSizeWidth')
    expect(options).not.toHaveProperty('imageWidth')
    expect(options).not.toHaveProperty('htmlTitle')
  })
  it('custom PDF dimensions apply, while print leaves paper selection to the system', () => {
    expect(buildExportOptions('pdf', { ...saved, pageSize: 'custom' }, noFeatures)).toMatchObject({ pageSizeWidth: 200, pageSizeHeight: 300 })
    const options = buildExportOptions('print', saved, noFeatures)
    expect(options).not.toHaveProperty('pageSize')
    expect(options).not.toHaveProperty('isLandscape')
    expect(options).toHaveProperty('footer')
  })
  it('hides header styling when both headers and footers are disabled', () => {
    const options = buildExportOptions('pdf', { ...saved, headerType: 0, footerType: 0, fontSettingsOverwrite: false }, noFeatures)
    expect(options).not.toHaveProperty('headerFooterStyled')
    expect(options).not.toHaveProperty('fontSize')
  })
  it('TOC, front matter and numbering options apply only when present in the document', () => {
    expect(buildExportOptions('styledHtml', saved, { ...noFeatures, hasHeadings: true, hasToc: true, hasFrontMatter: true })).toMatchObject({ tocTitle: 'Contents', tocIncludeTopHeading: false, showFrontMatter: true, autoNumberingHeadings: true })
  })
  it.each(['styledHtml', 'pdf', 'png', 'print'])('exports the body contents choice only for documents containing it (%s)', type => {
    expect(buildExportOptions(type, saved, { ...noFeatures, hasBodyToc: true })).toHaveProperty('showBodyToc', false)
    expect(buildExportOptions(type, saved, noFeatures)).not.toHaveProperty('showBodyToc')
  })
})
