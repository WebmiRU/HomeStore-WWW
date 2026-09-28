/**
 * Цвет из токенов темы для кода вне CSS.
 *
 * Нужен графикам: они рисуют на canvas, где ни var(--token), ни CSS-класс не
 * действуют, и зашитый цвет остался бы тёмным на светлой теме.
 *
 * Значение читается в момент вызова, а не один раз при загрузке модуля:
 * тема переключается на лету, и график должен перерисоваться под новую.
 */
export function themeToken(name: string, fallback = '#888'): string {
  if (import.meta.server) return fallback

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()

  return value === '' ? fallback : value
}

/** Тот же токен, но с прозрачностью: для заливки под линией. */
export function themeTokenAlpha(name: string, percent: number, fallback = '#888'): string {
  if (import.meta.server) return `${fallback}${Math.round((percent / 100) * 255).toString(16).padStart(2, '0')}`

  return `color-mix(in srgb, ${themeToken(name, fallback)} ${percent}%, transparent)`
}
