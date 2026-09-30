import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type OperationType = 'operation.replenish' | 'operation.writeoff'

/** Расход по одному свойству: сколько списать или пополнить. */
export type OperationPart = {
  property_id: number
  amount: number
}

export type OperationRow = {
  code: string
  item_id?: number
  /**
   * Количество штуками. У предмета, который расходуется частями, его нет:
   * расход идёт в parts, а количество меняется само, когда опустела штука.
   */
  quantity?: number
  parts?: OperationPart[]
}

export type OperationRequest = {
  type: OperationType
  payload: OperationRow[]
  /** Комментарий один на операцию: «куда списали» / «откуда пополнили». */
  comment?: string | null
}

export type OperationRowResult = {
  code: string
  item_id: number
  title: string
  delta: number
  before: number | null
  after: number | null
  /** Расход по свойству, если строка частичная. */
  property_id?: number | null
  property_title?: string | null
  amount?: number | null
  property_before?: number | null
  property_after?: number | null
}

export type OperationStoreResult = {
  type: OperationType
  comment: string | null
  operation: { id: number; comment: string | null } | null
  payload: OperationRow[]
  rows: OperationRowResult[]
}

class OperationModule extends FetchFactory<OperationRequest> {
  private readonly baseUrl = '/operation'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async store(data: OperationRequest): Promise<OperationStoreResult> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as OperationStoreResult
  }

  /**
   * Корректировка остатка фактическим: сколько на руках, а не на сколько.
   *
   * Дельту считает сервер. Если бы её считал клиент, ошибка в арифметике была
   * бы неотличима от ошибки в остатке, и журнал показал бы не то движение.
   */
  async correct(data: { payload: Record<string, unknown>[]; comment?: string | null }): Promise<{ id: number }> {
    const result = await this.call('POST', `${this.baseUrl}/correction`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as { id: number }
  }
}

export default OperationModule
