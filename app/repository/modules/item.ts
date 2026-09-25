import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { ImageResponse } from './image'
import type { ItemPayload, StorePayload } from './code'
import type { AccessRight } from './access'

export type ItemResponse = {
  type: 'item'
  rights?: AccessRight[]
  is_owner?: boolean
  can_edit?: boolean
  can_delete?: boolean
  code: string | null
  payload: ItemPayload
  store: StorePayload[] | null
  images: ImageResponse[] | null
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

class ItemModule extends FetchFactory<any> {
  private readonly baseUrl = '/item'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<ItemResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<ItemResponse>
  }

  async get(id: number): Promise<ItemResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ItemResponse
  }

  async create(data: Partial<ItemPayload> & { code?: string | null }): Promise<ItemResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ItemResponse
  }

  async update(id: number, data: Partial<ItemPayload> & { code?: string | null }): Promise<ItemResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ItemResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default ItemModule
