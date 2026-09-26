/**
 * Символ, который физическая клавиша даёт в американской раскладке:
 * [без Shift, с Shift].
 *
 * e.code не зависит от раскладки клавиатуры, поэтому символы ()/:., —
 * не превращаются в Ж/ю/б при русском языке. Именно поэтому клавиши
 * разбираются по code, а не по key: key отдаёт то, что напечаталось бы
 * с учётом текущей раскладки, и при русской получились бы буквы-близнецы
 * вместо латинских.
 */

const KEY_SYMBOLS: Record<string, [string, string]> = {
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  Backquote: ['`', '~'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Space: [' ', ' '],
}

const SHIFT_DIGITS = [')', '!', '@', '#', '$', '%', '^', '&', '*', '(']

/**
 * Латинский символ клавиши либо пустая строка.
 *
 * Пустая строка — непечатная клавиша (Enter, Tab, стрелки) или
 * раскладка, для которой правила нет.
 */
export function keyToLatin(e: KeyboardEvent): string {
  const code = e.code
  const shifted = e.shiftKey

  // Буквы: физическая клавиша 'KeyA'..'KeyZ' — латинская буква по определению.
  if (code.startsWith('Key')) {
    const latin = code.slice(3) // 'A'..'Z'
    return shifted ? latin.toUpperCase() : latin.toLowerCase()
  }

  // Цифры: 'Digit0'..'Digit9'.
  if (code.startsWith('Digit')) {
    const digit = code.slice(5) // '0'..'9'
    if (digit.length === 1) {
      const i = digit.charCodeAt(0) - 48
      return shifted ? SHIFT_DIGITS[i]! : digit
    }
  }

  const pair = KEY_SYMBOLS[code]
  if (pair) {
    return shifted ? pair[1] : pair[0]
  }

  return ''
}
