import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from './code'

export type PropertyGroupResponse = {
  id: number
  user_id: number
  user?: UserBrief | null
  title: string
  created_at: string
  updated_at: string
}

export type PropertyGroupData = {
  title?: string
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

class PropertyGroupModule extends FetchFactory<any> {
  private readonly baseUrl = '/property-group'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<PropertyGroupResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<PropertyGroupResponse>
  }

  async all(): Promise<PropertyGroupResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<PropertyGroupResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as PropertyGroupResponse
  }

  async create(data: PropertyGroupData): Promise<PropertyGroupResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as PropertyGroupResponse
  }

  async update(id: number, data: PropertyGroupData): Promise<PropertyGroupResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as PropertyGroupResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default PropertyGroupModule
