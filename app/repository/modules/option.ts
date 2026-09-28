import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

/**
 * Режим работы на странице предметов: обычный поиск, пополнение или списание.
 * Раньше жил в sessionStorage и переживал одну вкладку, теперь хранится у
 * пользователя в настройках.
 */
export type OperationMode = 'search' | 'replenish' | 'writeoff'

export type OptionResponse = {
  /**
   * Ключи пунктов меню в порядке пользователя, верхнего уровня и вложенные
   * вперемешку. Пустой список означает «порядок как в приложении».
   */
  menu_order: string[]
  /** Ключи пунктов, которые человек спрятал. */
  menu_hidden: string[]
  operation_mode: OperationMode
  /** Показывать ли блок ввода кода внизу страниц. */
  show_code_block: boolean
  /**
   * Запоминать ли выбранный режим работы.
   *
   * Выключено — главная каждый раз начинает с режима по умолчанию, и
   * переключение живёт только до перезагрузки страницы.
   */
  remember_operation_mode: boolean
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
