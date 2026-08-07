import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type StoreParent = {
  id: number
  title: string
  parent_id: number | null
  created_at: string
  updated_at: string
}

export type StoreResponse = {
  id: number
  title: string
  title_print: string | null
  parent_id: number | null
  created_at: string
  updated_at: string
  parents: StoreParent[]code?: string | null
}

class StoreModule extends FetchFactory<any> {
  private readonly baseUrl = '/store'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(): Promise<StoreResponse[]> {
    // store/all отдаёт все записи без пагинации (удобно для построения дерева)
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<StoreResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as StoreResponse
  }

  async create(data: { title: string; title_print?: string | null; parent_id?: number | null }): Promise<StoreResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as StoreResponse
  }

  async update(id: number, data: { title?: string; title_print?: string | null; parent_id?: number | null }): Promise<StoreResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as StoreResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default StoreModule
