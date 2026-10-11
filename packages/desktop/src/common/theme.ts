export const DOCUMENT_THEMES = ['github', 'academic', 'liber'] as const
export type Appearance = 'system' | 'light' | 'dark'
export type ResolvedAppearance = 'light' | 'dark'
export interface CustomDocumentTheme {
  id: string
  name: string
  css: string
}
export const getThemeBackgroundColor = (appearance: string | undefined): string =>
  appearance === 'dark' ? '#282828' : '#ffffff'
export const normalizeDocumentTheme = (
  theme: unknown,
  customThemes: CustomDocumentTheme[] = []
): string =>
  typeof theme === 'string' &&
  (DOCUMENT_THEMES.some((id) => id === theme) || customThemes.some(({ id }) => id === theme))
    ? theme
    : 'github'
