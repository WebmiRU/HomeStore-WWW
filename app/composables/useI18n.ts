import { computed } from 'vue'
import { en } from '~/i18n/en'
import { ru, type TranslationKey } from '~/i18n/ru'
import type { Locale } from '~/repository/modules/option'

// Оба словаря расплющиваются в точечные ключи: en тоже вложенный, и без
// flatten по нему не нашлось бы ни одного ключа.
const DICTIONARIES: Record<Locale, Record<string, string>> = {
  ru: flatten(ru),
  en: flatten(en),
}

const COOKIE = 'home-store-locale'

// Полнота словарей проверяется типами (en: Record<TranslationKey, string>),
// но vue-tsc в проекте не запускается, и опечатку в ключе никто не поймает.
// Поэтому в разработке проверяем ключи сами — один раз, при загрузке.
if (import.meta.dev) {
  const missing = Object.keys(DICTIONARIES.ru).filter((key) => DICTIONARIES.en[key] === undefined)

  if (missing.length > 0) {
    console.warn(`[i18n] без перевода на английский: ${missing.join(', ')}`)
  }
}

/**
 * Язык интерфейса.
 *
 * Русский и английский, русский по умолчанию. Три источника, по важности:
 *
 * 1. cookie — читается и на сервере, поэтому первый экран уже на нужном
 *    языке. Пока её нет, первый экран русский: токен лежит в localStorage и на
 *    сервере недоступен, а язык из настроек приезжает позже, уже с ответом.
 * 2. настройка пользователя — язык, выбранный в «Настройках», переносится на
 *    другое устройство.
 * 3. cookie обновляется при смене языка, чтобы следующая загрузка не ждала
 *    ответа сервера.
 *
 * Ключи незнакомые не молчат: в разработке t() жалуется в консоль, в
 *production отдаёт сам ключ — заметнее, чем пустое место.
 */
export function useI18n() {
  /** Cookie, а не localStorage: её видно при отрисовке на сервере. */
  const stored = useCookie<string | null>(COOKIE, { default: () => null, sameSite: 'lax' })

  const locale = useState<Locale>('locale', () => 'ru')

  // На сервере берём из cookie, на клиенте — из того же состояния, иначе первая
  // отрисовка разошлась бы с серверной.
  if (import.meta.server && stored.value) {
    locale.value = isLocale(stored.value) ? stored.value : 'ru'
  }

  /** Переключал ли язык человек в этой вкладке: тогда его выбор главнее ответа. */
  let touchedLocale = false

  const dictionary = computed(() => DICTIONARIES[locale.value])

  function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const template = dictionary.value[key] ?? ru[key as keyof typeof ru]

    if (template === undefined) {
      if (import.meta.dev) console.warn(`[i18n] нет перевода: ${key}`)
      return key
    }

    return params ? interpolate(template, params) : template
  }

  /**
   * Переключает язык на этом устройстве: состояние и cookie.
   *
   * В сервер не пишет: язык такая же настройка, как остальные, и сохраняется
   * вместе с ними кнопкой «Сохранить» на странице настроек. Cookie нужна,
   * чтобы следующая загрузка не ждала ответа сервера и показала сразу нужный
   * язык, а не русский.
   */
  function setLocale(next: Locale): void {
    if (!isLocale(next)) return

    touchedLocale = true
    locale.value = next
    stored.value = next
  }

  // Настройки приехали — язык из них главнее cookie: cookie могла остаться от
  // прежнего выбора, а на новом устройстве её могло не быть вовсе.
  //
  // Настройки берутся здесь, при создании composable, а не внутри watch: в
  // колбэке watcher'а контекста Nuxt уже нет, и useOptions() из него упал бы
  // с «nuxt instance unavailable».
  const { options } = useOptions()

  // immediate: настройки могли прийти раньше, чем страница позвала useI18n
  // (например, вкладка читала их при монтировании). Без immediate watcher
  // сработал бы только на следующем изменении, и на новом устройстве человек
  // увидел бы русский интерфейс при английском в настройках.
  watch(
    () => options.value.locale,
    (next) => {
      if (isLocale(next) && !touchedLocale) {
        locale.value = next
        stored.value = next
      }
    },
    { immediate: true },
  )

  /**
   * Строка по числу: берётся форма one/few/many.
   *
   * Русский различает «1 код», «2 кода» и «5 кодов», английский — только
   * единственное и множественное. Форму выбирает язык, а не код фичи: в
   * словаре просто три ключа, и в английском второй и третий совпадают.
   * Вместе со словом обычно меняется и сказуемое («встречается»/«встречаются»),
   * поэтому форму приходится выбирать и для всей фразы.
   */
  function tp(
    key: TranslationKey,
    count: number,
    params: Record<string, string | number> = {},
  ): string {
    return t(`${key}.${pluralForm(count)}` as TranslationKey, { count, ...params })
  }

  /** Само слово во множественном числе: t('codes.code_word', ...) через tp. */
  function pluralForm(count: number): 'one' | 'few' | 'many' {
    if (locale.value !== 'ru') return count === 1 ? 'one' : 'many'

    const mod10 = count % 10
    const mod100 = count % 100

    if (mod10 === 1 && mod100 !== 11) return 'one'
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few'

    return 'many'
  }

  return { t, tp, locale, setLocale, isLocale }
}

function isLocale(value: string): value is Locale {
  return value === 'ru' || value === 'en'
}

/** Подстановка {скобок} в текст. */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  )
}

/** Раскрывает вложенный словарь в плоские точечные ключи. */
function flatten(source: object, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(source)) {
    const path = prefix === '' ? key : `${prefix}.${key}`

    if (typeof value === 'string') {
      result[path] = value
    } else {
      Object.assign(result, flatten(value, path))
    }
  }

  return result
}
