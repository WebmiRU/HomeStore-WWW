import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserProfileResponse } from './userProfile'

export type WarehouseResponse = {
  id: number
  title: string
  user_id: number
  can_create: boolean
  user?: UserProfileResponse | null
  created_at: string
  updated_at: string
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

class WarehouseModule extends FetchFactory<any> {
  private readonly baseUrl = '/warehouse'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<WarehouseResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<WarehouseResponse>
  }

  async all(): Promise<WarehouseResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<WarehouseResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as WarehouseResponse
  }

  async create(data: { title: string; user_id: number }): Promise<WarehouseResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as WarehouseResponse
  }

  async update(id: number, data: { title?: string; user_id?: number }): Promise<WarehouseResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as WarehouseResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default WarehouseModule
