import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from './code'
import type { PropertyResponse } from './property'

export type CategoryBrief = {
  id: number
  title: string
}

export type CategoryResponse = {
  id: number
  user_id: number
  user?: UserBrief | null
  title: string
  parent_id: number | null
  parent?: CategoryBrief | null
  /** Сколько предметов лежит прямо в этой категории, без вложенных. */
  items_count: number
  created_at: string
  updated_at: string
}

export type CategoryData = {
  title?: string
  parent_id?: number | null
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

class CategoryModule extends FetchFactory<any> {
  private readonly baseUrl = '/category'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<CategoryResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<CategoryResponse>
  }

  /** Всё дерево без постраничного обрезания — для селектов. */
  async all(): Promise<CategoryResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<CategoryResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as CategoryResponse
  }

  /**
   * Набор свойств, которые имеет смысл заполнить для этой категории.
   *
   * Считается сервером по уже заполненным значениям и включает вложенные
   * категории, поэтому у новой категории набора нет: он появляется сам, как
   * только кто-то что-нибудь заполнит.
   */
  async properties(id: number): Promise<PropertyResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/${id}/properties`)
    return (result as any)?.data ?? result
  }

  async create(data: CategoryData): Promise<CategoryResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as CategoryResponse
  }

  async update(id: number, data: CategoryData): Promise<CategoryResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as CategoryResponse
  }

  /**
   * Удаляет категорию вместе со всей ветвью. Предметы при этом остаются:
   * сервер просто снимает с них ссылку на категорию.
   */
  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default CategoryModule
