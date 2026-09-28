/**
 * Оформление интерфейса: тема и акцент.
 *
 * Это две независимые настройки, а не список тем. Тема — про комфорт
 * (светло или темно, либо как в системе), акцент — про внешний вид (какого
 * цвета кнопки и ссылки). «Светлая пурпурная» — это пересечение двух
 * настроек, и хранить его одним значением значило бы плодить комбинации
 * вместо двух коротких списков.
 *
 * У каждой настройки три источника, по важности — те же три, что и у языка:
 *
 * 1. cookie — читается на сервере, поэтому первый экран уже в том виде, в
 *    котором человек его оставил. Без неё страница моргнула бы тёмной и тут
 *    же перекрасилась.
 * 2. настройка пользователя — приезжает вместе с остальными настройками и
 *    переносится на другое устройство, чем человек может работать с одного
 *    аккаунта.
 * 3. система — при теме «как в системе» берётся prefers-color-scheme и
 *    следится за его сменой, пока вкладка открыта.
 *
 * Выбор человека в этой вкладке главнее ответа сервера: cookie перезаписывает
 * настройку, и только что сделанный выбор не откатывается приходом ответа.
 */
import type { Accent, Theme } from '~/repository/modules/option'

/** Что из темы получилось на самом деле: «как в системе» уже разрешён. */
export type ResolvedTheme = 'dark' | 'light'

const THEME_COOKIE = 'home-store-theme'
const ACCENT_COOKIE = 'home-store-accent'

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light' || value === 'system'
}

function isAccent(value: unknown): value is Accent {
  return value === 'green' || value === 'purple' || value === 'blue' || value === 'amber'
}

export function useTheme() {
  const { options, save, loaded } = useOptions()

  /** Cookie, а не localStorage: её видно при отрисовке на сервере. */
  const storedTheme = useCookie<string | null>(THEME_COOKIE, { default: () => null, sameSite: 'lax' })
  const storedAccent = useCookie<string | null>(ACCENT_COOKIE, { default: () => null, sameSite: 'lax' })

  const mode = useState<Theme>('theme', () => 'dark')
  const accent = useState<Accent>('accent', () => 'green')
  const system = useState<ResolvedTheme>('theme-system', () => 'dark')

  /** Менял ли человек оформление в этой вкладке: тогда его выбор главнее. */
  let touched = false

  if (import.meta.client || import.meta.server) {
    if (isTheme(storedTheme.value)) mode.value = storedTheme.value
    if (isAccent(storedAccent.value)) accent.value = storedAccent.value
  }

  const resolved = computed<ResolvedTheme>(() => (mode.value === 'system' ? system.value : mode.value))

  /**
   * Настройки приехали, а человек оформление в этой вкладке не трогал: значит,
   * показываем то, что сохранено у него в аккаунте, и запоминаем cookie — со
   * следующей загрузки первый экран будет таким же сразу.
   */
  watch(loaded, (isLoaded) => {
    if (!isLoaded || touched) return

    if (isTheme(options.value.theme) && options.value.theme !== mode.value) {
      mode.value = options.value.theme
      storedTheme.value = options.value.theme
    }

    if (isAccent(options.value.accent) && options.value.accent !== accent.value) {
      accent.value = options.value.accent
      storedAccent.value = options.value.accent
    }
  })

  /**
   * Системная тема и её смена при открытой вкладке.
   *
   * На сервере prefers-color-scheme не существует, поэтому до загрузки там
   * тёмная: у человека с «как в системе» первый экран будет тёмным, пока
   * страница не доехала до клиента. Cookie снимает это со второй загрузки.
   */
  function watchSystem(): void {
    if (!import.meta.client) return

    const query = window.matchMedia('(prefers-color-scheme: light)')

    system.value = query.matches ? 'light' : 'dark'

    query.addEventListener('change', (event) => {
      system.value = event.matches ? 'light' : 'dark'
    })
  }

  /**
   * Применяет оформление и запоминает его в настройках.
   *
   * В настройках — потому что человек работает с одного аккаунта с разных
   * устройств, и оформление должно быть одно и то же везде. Пока сервер
   * отвечает, применяем сразу: ждать ответа, чтобы перекрасить страницу,
   * незачем.
   */
  async function persist(patch: { theme?: Theme; accent?: Accent }): Promise<void> {
    mode.value = patch.theme ?? mode.value
    accent.value = patch.accent ?? accent.value
    touched = true

    storedTheme.value = mode.value
    storedAccent.value = accent.value

    try {
      await save(patch)
    } catch {
      // Cookie уже обновлена, и на этом устройстве всё работает. Уведомление
      // об ошибке сохраненияhere не показываем: оформление применилось, человек
      // увидел результат, а рассинхронизацию с сервером увидит на следующей
      // загрузке и переживёт её без последствий.
    }
  }

  function setTheme(next: Theme): void {
    if (!isTheme(next) || next === mode.value) return

    void persist({ theme: next })
  }

  function setAccent(next: Accent): void {
    if (!isAccent(next) || next === accent.value) return

    void persist({ accent: next })
  }

  /** Переключает тёмную и светлую, не затрагивая «как в системе». */
  function toggle(): void {
    setTheme(resolved.value === 'light' ? 'dark' : 'light')
  }

  return { mode, resolved, accent, setTheme, setAccent, toggle, watchSystem }
}
