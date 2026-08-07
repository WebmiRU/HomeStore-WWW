import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type StorePayload = {
  id: number
  title: string
  parent_id: number | null
  created_at: string
  updated_at: string
}

export type ItemPayload = {
  id: number
  title: string
  store_id: number | null
  created_at: string
  updated_at: string
}

export type CodeSearchResponse = {
  code: string
  type: 'item' | 'store' | null
  payload: ItemPayload | StorePayload | null
  parents: StorePayload[]
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
}

export default CodeModule
