import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { ImageResponse } from './image'
import type { AccessRight } from './access'

export type UserBrief = {
  id: number
  name: string
  email: string
}

export type StorePayload = {
  id: number
  user_id?: number | null
  user?: UserBrief | null
  title: string
  parent_id: number | null
  created_at: string
  updated_at: string
  images?: ImageResponse[]
}

export type ItemPayload = {
  id: number
  user_id?: number | null
  user?: UserBrief | null
  title: string
  title_print: string | null
  store_id: number | null
  category_id: number | null
  quantity: number | null
  created_at: string
  updated_at: string
  images?: ImageResponse[]
}

export type CodeMatch = {
  code: string
  user_id: number | null
  user?: UserBrief | null
  type: 'item' | 'store' | null
  payload: ItemPayload | StorePayload | null
}

export type CodeSearchSingle = {
  code: string
  type: 'item' | 'store' | null
  payload: ItemPayload | StorePayload | null
}

export type CodeSearchAmbiguous = {
  code: string
  ambiguous: true
  matches: CodeMatch[]
}

/**
 * Код найден, но не привязан ни к предмету, ни к хранилищу: наклейка из
 * сгенерированного набора, ещё не использованная. Это не ошибка, поэтому
 * сервер отдаёт 200 с отдельным телом, а не 404.
 */
export type CodeSearchBlank = {
  code: string
  blank: true
  label_set?: {
    id: number
    title: string
  } | null
}

export type CodeSearchResponse = CodeSearchSingle | CodeSearchAmbiguous | CodeSearchBlank

/**
 * Возрастная корзина для выбора удаляемого. days = 0 — без ограничения
 * по возрасту. Список приходит с сервера: набор порогов влияет на то,
 * что страница вообще предложит удалить, и не должен расходиться с бэком.
 */
export type OrphanAgeBucket = {
  days: number
  label: string
  count: number
}

export type OrphanedCodesSummary = {
  total: number
  oldest: string | null
  newest: string | null
  buckets: OrphanAgeBucket[]
}

export type OrphanedCodesPreview = {
  blob: Blob
  /** Сколько кодов попало в выборку. */
  total: number
  /** Сколько из них реально отрисовано (может быть меньше при обрезке). */
  rendered: number
}

export type FulltextSearchResult = {
  type: 'item' | 'store'
  rank: number
  sim: number
  payload: {
    id: number
    title: string
    title_print: string | null
    store_id?: number | null
    parent_id?: number | null
    created_at: string
    updated_at: string
    rights?: AccessRight[]
    is_owner?: boolean
    can_edit?: boolean
    can_delete?: boolean
    images?: ImageResponse[]
    code?: string | null
  }
}

class CodeModule extends FetchFactory<CodeSearchResponse> {
  private readonly baseUrl = '/code'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async search(q: string): Promise<CodeSearchResponse> {
    const result = await this.call('GET', `${this.baseUrl}/search`, undefined, {
      params: { q },
    })
    // Laravel JsonResource оборачивает ответ в ключ 'data'
    if (result && typeof result === 'object' && 'data' in result) {
      return (result as { data: CodeSearchResponse }).data
    }
    return result as CodeSearchResponse
  }

  async fulltextSearch(q: string): Promise<FulltextSearchResult[]> {
    const result = await this.call('GET', '/search', undefined, {
      params: { q },
    })
    if (result && typeof result === 'object' && 'data' in result) {
      return (result as { data: FulltextSearchResult[] }).data
    }
    return []
  }

  /** Сводка по кодам, потерявшим связь с набором этикеток. */
  async orphanedCodes(): Promise<OrphanedCodesSummary> {
    const result = await this.call('GET', `${this.baseUrl}/orphans`)
    return (result as unknown as OrphanedCodesSummary) ?? { total: 0, oldest: null, newest: null, buckets: [] }
  }

  /**
   * PDF с кодами, которые удалит deleteOrphanedCodes с тем же фильтром.
   * Нужен, чтобы увидеть, что именно удаляется, и сверить с бумагой.
   */
  async orphanedCodesPreview(days: number): Promise<OrphanedCodesPreview> {
    let total = 0
    let rendered = 0

    const blob = await this.call(
      'GET',
      `${this.baseUrl}/orphans/preview`,
      undefined,
      {
        params: { older_than_days: days },
        responseType: 'blob',
        onResponse({ response }) {
          total = Number(response.headers.get('x-codes-total') ?? 0)
          rendered = Number(response.headers.get('x-codes-rendered') ?? 0)
        },
      }
    )

    return { blob: blob as unknown as Blob, total, rendered }
  }

  /** Массовое удаление осиротевших кодов; возвращает количество удалённых. */
  async deleteOrphanedCodes(days: number): Promise<number> {
    const result = await this.call('DELETE', `${this.baseUrl}/orphans`, undefined, {
      params: { older_than_days: days },
    })
    return Number((result as unknown as { deleted?: number })?.deleted ?? 0)
  }
}

export default CodeModule
