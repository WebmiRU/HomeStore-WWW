import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { LabelPresetResponse } from './labelPreset'
import type { ItemResponse } from './item'
import type { StoreResponse } from './store'

export type LabelListResponse = {
  id: number
  title: string
  label_preset_id: number
  created_at: string
  updated_at: string
  label_preset?: LabelPresetResponse | null
  items?: ItemResponse[]
  stores?: StoreResponse[]
}

export type LabelListCreateData = {
  title: string
  label_preset_id: number
}

type PaginatedResponse<T> = {
  data: T[]
  links: {
    first: string | null
    last: string | null
    prev: string | null
    next: string | null
  }
  meta: {
    current_page: number
    from: number | null
    last_page: number
    per_page: number
    to: number | null
    total: number
  }
}

class LabelListModule extends FetchFactory<any> {
  private readonly baseUrl = '/label-list'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<LabelListResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<LabelListResponse>
  }

  async get(id: number): Promise<LabelListResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as LabelListResponse
  }

  async create(data: LabelListCreateData): Promise<LabelListResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as LabelListResponse
  }

  async update(id: number, data: Partial<LabelListCreateData>): Promise<LabelListResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as LabelListResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }

  async all(): Promise<LabelListResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    const data = (result as any)?.data ?? result
    return (Array.isArray(data) ? data : []) as LabelListResponse[]
  }

  async attachItem(labelListId: number, itemId: number): Promise<void> {
    await this.call('POST', `${this.baseUrl}/${labelListId}/item/${itemId}`)
  }

  async detachItem(labelListId: number, itemId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${labelListId}/item/${itemId}`)
  }

  async attachStore(labelListId: number, storeId: number): Promise<void> {
    await this.call('POST', `${this.baseUrl}/${labelListId}/store/${storeId}`)
  }

  async detachStore(labelListId: number, storeId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${labelListId}/store/${storeId}`)
  }
}

export default LabelListModule
