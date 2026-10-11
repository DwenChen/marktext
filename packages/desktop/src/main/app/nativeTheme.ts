import type { Appearance } from '../../common/theme'
export const getNativeThemeSource = ({ appearance }: { appearance?: unknown }): Appearance =>
  appearance === 'light' || appearance === 'dark' ? appearance : 'system'
