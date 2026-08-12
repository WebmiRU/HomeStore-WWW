import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type OperationType = 'operation.replenish' | 'operation.writeoff'

export type OperationRow = {
  code: string
  quantity: number
}

export type OperationRequest = {
  type: OperationType
  payload: OperationRow[]
}

class OperationModule extends FetchFactory<OperationRequest> {
  private readonly baseUrl = '/operation'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async store(data: OperationRequest): Promise<OperationRequest> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as OperationRequest
  }
}

export default OperationModule
