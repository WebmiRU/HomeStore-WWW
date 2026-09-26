import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from './code'

export type UnitResponse = {
  id: number
  user_id: number
  user?: UserBrief | null
  /** Короткое обозначение: «мм». */
  title_short: string
  /** Полное название: «миллиметр». */
  title_full: string
  created_at: string
  updated_at: string
}

export type UnitData = {
  title_short?: string
  title_full?: string
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

class UnitModule extends FetchFactory<any> {
  private readonly baseUrl = '/unit'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<UnitResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<UnitResponse>
  }

  async all(): Promise<UnitResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<UnitResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as UnitResponse
  }

  async create(data: UnitData): Promise<UnitResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as UnitResponse
  }

  async update(id: number, data: UnitData): Promise<UnitResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as UnitResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default UnitModule
