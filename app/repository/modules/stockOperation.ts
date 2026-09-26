import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type StockDirectionValue = 'writeoff' | 'replenish'

export type StockOperationRow = {
  id: number
  item_id: number | null
  item_title: string
  /** Строка исходной операции, если эта строка — возврат. */
  source_row_id: number | null
  quantity: number
  reversed_quantity: number
  /** Сколько ещё можно вернуть по строке. */
  remaining: number
  before: number | null
  after: number | null
  is_returned: boolean
}

export type StockOperation = {
  id: number
  direction: StockDirectionValue
  direction_label: string
  comment: string | null
  user_id: number | null
  author: { id: number; name: string } | null
  reversed_operation_id: number | null
  reversed_at: string | null
  is_reversal: boolean
  is_reversed: boolean
  created_at: string
  rows: StockOperationRow[]
}

export type StockOperationFilters = {
  page?: number
  per_page?: number
  direction?: StockDirectionValue | ''
  comment?: string
  item_id?: number
  period?: 'today' | 'week' | 'month' | 'custom' | ''
  date_from?: string
  date_to?: string
  only_reversals?: boolean
  only_reversed?: boolean
  only_active?: boolean
}

export type StockOperationReverseRequest = {
  rows: { row_id: number; quantity: number }[]
  comment?: string | null
}

export type StockOperationTotals = {
  /** Число операций и сумма количеств по ним. */
  operations: number
  units: number
}

export type StockOperationSummary = {
  writeoff: StockOperationTotals
  replenish: StockOperationTotals
  /** Сколько операций откачено (полностью или частично). */
  reversed: number
  /** Сколько операций сами являются возвратами. */
  reversals: number
}

type PaginatedResponse<T> = {
  data: T[]
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}

class StockOperationModule extends FetchFactory<any> {
  private readonly baseUrl = '/stock-operation'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(
    filters: StockOperationFilters
  ): Promise<PaginatedResponse<StockOperation>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: { ...filters },
    })
    return result as unknown as PaginatedResponse<StockOperation>
  }

  async get(id: number): Promise<StockOperation> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as StockOperation
  }

  /** Откат: полный или частичный (по строкам и по количеству). */
  async reverse(id: number, data: StockOperationReverseRequest): Promise<StockOperation> {
    const result = await this.call('POST', `${this.baseUrl}/${id}/reverse`, data)
    return ((result as any)?.data ?? result) as StockOperation
  }

  /** Сводка по тем же фильтрам: сколько операций и штук списано/пополнено. */
  async summary(filters: StockOperationFilters): Promise<StockOperationSummary> {
    const result = await this.call('GET', `${this.baseUrl}/summary`, undefined, {
      params: { ...filters },
    })
    return (result as any)?.data ?? (result as StockOperationSummary)
  }

  /** История движений по предмету — для карточки. */
  async forItem(
    itemId: number,
    params?: { page?: number; per_page?: number }
  ): Promise<PaginatedResponse<StockOperation>> {
    const result = await this.call('GET', `/item/${itemId}/movements`, undefined, { params })
    return result as unknown as PaginatedResponse<StockOperation>
  }
}

export default StockOperationModule
