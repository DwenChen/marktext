// Labels already have their own space in the layout. Strip punctuation from
// older translations instead of adding another colon in the control template.
export const preferenceLabel = (description: string): string =>
  description.trim().replace(/(?:[:：]\s*)+$/, '')
