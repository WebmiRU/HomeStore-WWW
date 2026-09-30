import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

/**
 * Режим работы на странице предметов: обычный поиск, пополнение или списание.
 * Раньше жил в sessionStorage и переживал одну вкладку, теперь хранится у
 * пользователя в настройках.
 */
export type OperationMode = 'search' | 'replenish' | 'writeoff'

/** Язык интерфейса и сообщений. Русский по умолчанию. */
export type Locale = 'ru' | 'en'

/**
 * Тема оформления.
 *
 * Тип живёт здесь, а не в useTheme: его знает и сервер, отдавая настройку, и
 * страница настроек, и переключатель в шапке — всем им нужен один и тот же
 * список, иначе значения разъедутся.
 */
export type Theme = 'dark' | 'light' | 'system'

/**
 * Акцентный цвет: какого цвета кнопки, ссылки и метки о состояниях.
 *
 * Отдельная настройка, а не часть темы: тема про светлоту, акцент — про цвет.
 * Одно поле означало бы, что «светлая пурпурная» — это отдельное значение, и
 * список тем разрастался бы на каждое сочетание.
 */
export type Accent = 'green' | 'purple' | 'blue' | 'amber'

export type OptionResponse = {
  /**
   * Ключи пунктов меню в порядке пользователя, верхнего уровня и вложенные
   * вперемешку. Пустой список означает «порядок как в приложении».
   */
  menu_order: string[]
  /** Ключи пунктов, которые человек спрятал. */
  menu_hidden: string[]
  operation_mode: OperationMode
  /** Язык интерфейса и сообщений: по нему сервер отвечает на русском или на английском. */
  locale: Locale
  /** Показывать ли блок ввода кода внизу страниц. */
  /**
   * Запоминать ли выбранный режим работы.
   *
   * Выключено — главная каждый раз начинает с режима по умолчанию, и
   * переключение живёт только до перезагрузки страницы.
   */
  remember_operation_mode: boolean
  /**
   * Тема оформления: тёмная, светлая или как в системе.
   *
   * Хранится в настройках, а не только в cookie браузера: человек работает с
   * одного аккаунта с разных устройств, и тема должна быть одна и та же.
   */
  theme: Theme
  /**
   * Акцентный цвет. Хранится рядом с темой и по той же причине: человек
   * работает с одного аккаунта с разных устройств.
   */
  accent: Accent
}

export type OptionData = Partial<OptionResponse>

class OptionModule extends FetchFactory<any> {
  private readonly baseUrl = '/option'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  /** Настройки текущего пользователя. Всегда с умолчаниями. */
  async get(): Promise<OptionResponse> {
    const result = await this.call('GET', this.baseUrl)
    return ((result as any)?.data ?? result) as OptionResponse
  }

  /** Сохраняет настройки. Отдаёт ровно то, что сохранилось. */
  async update(data: OptionData): Promise<OptionResponse> {
    const result = await this.call('PUT', this.baseUrl, data)
    return ((result as any)?.data ?? result) as OptionResponse
  }
}

export default OptionModule
