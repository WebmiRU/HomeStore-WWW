import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from './code'

export type DictionaryValueResponse = {
  id: number
  dictionary_id: number
  title: string
  created_at: string
  updated_at: string
}

export type DictionaryResponse = {
  id: number
  user_id: number
  user?: UserBrief | null
  title: string
  values: DictionaryValueResponse[]
  values_count: number
  created_at: string
  updated_at: string
}

export type DictionaryData = {
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

class DictionaryModule extends FetchFactory<any> {
  private readonly baseUrl = '/dictionary'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<DictionaryResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<DictionaryResponse>
  }

  async all(): Promise<DictionaryResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<DictionaryResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as DictionaryResponse
  }

  async create(data: DictionaryData): Promise<DictionaryResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as DictionaryResponse
  }

  async update(id: number, data: DictionaryData): Promise<DictionaryResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as DictionaryResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }

  /**
   * Значения справочника — часть самого справочника, а не самостоятельные
   * записи: своего user_id у них нет, а верхнего уровня у API нет, поэтому
   * маршруты значений вложены под справочник.
   */
  async values(dictionaryId: number): Promise<DictionaryValueResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/${dictionaryId}/values`)
    return (result as any)?.data ?? result
  }

  async createValue(dictionaryId: number, data: { title: string }): Promise<DictionaryValueResponse> {
    const result = await this.call('POST', `${this.baseUrl}/${dictionaryId}/values`, data)
    return ((result as any)?.data ?? result) as DictionaryValueResponse
  }

  async updateValue(
    dictionaryId: number,
    valueId: number,
    data: { title?: string },
  ): Promise<DictionaryValueResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${dictionaryId}/values/${valueId}`, data)
    return ((result as any)?.data ?? result) as DictionaryValueResponse
  }

  async deleteValue(dictionaryId: number, valueId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${dictionaryId}/values/${valueId}`)
  }
}

export default DictionaryModule
