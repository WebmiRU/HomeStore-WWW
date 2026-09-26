import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type OperationType = 'operation.replenish' | 'operation.writeoff'

export type OperationRow = {
  code: string
  item_id?: number
  quantity: number
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
}

export default OperationModule
