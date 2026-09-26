import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { ImageResponse } from './image'
import type { CategoryBrief } from './category'
import type { VendorBrief } from './vendor'
import type { PropertyType } from './property'
import type { ItemPayload, StorePayload } from './code'
import type { AccessRight } from './access'

/** Свойство внутри заполненного значения — то, чем оно подписано в списке. */
export type ItemPropertyBrief = {
  id: number
  title: string
  type: PropertyType
  type_label: string
  unit: {
    id: number
    title_short: string
    title_full: string
  } | null
}

export type ItemPropertyResponse = {
  id: number
  item_id: number
  property_id: number
  property?: ItemPropertyBrief | null
  value: string | null
  dictionary_value_id: number | null
  dictionary_value: {
    id: number
    title: string
  } | null
  sort: number
}

/**
 * Значение свойства в том виде, в каком его принимает сервер.
 *
 * У одного свойства может быть несколько значений, поэтому у него список
 * values, а не одно поле. Для обычного свойства в списке одно значение,
 * для словарного — dictionary_value_id без value.
 */
export type ItemPropertyInput = {
  property_id: number
  values: Array<{ value?: string | null; dictionary_value_id?: number | null }>
}

export type ItemData = Partial<ItemPayload> & {
  codes?: string[]
  category_id?: number | null
  vendor_id?: number | null
  properties?: ItemPropertyInput[]
}

export type ItemResponse = {
  type: 'item'
  rights?: AccessRight[]
  is_owner?: boolean
  can_edit?: boolean
  can_delete?: boolean
  /** Главный код: первый в codes, он же печатается на этикетку по умолчанию. */
  code: string | null
  /** Все коды предмета, от главного к прочим. Есть у карточки и ответа на сохранение. */
  codes?: string[]
  /**
   * Коды, по которым тот же предмет есть у других. Приходит только в ответе
   * на сохранение: дубль не запрещается, но о нём стоит сказать.
   */
  conflicts?: Record<string, Array<{ id: number; title: string }>>
  payload: ItemPayload
  store: StorePayload[] | null
  category?: CategoryBrief | null
  vendor?: VendorBrief | null
  images: ImageResponse[] | null
  /** Есть только у карточки и ответа на сохранение, не у строки списка. */
  properties?: ItemPropertyResponse[]
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

  /** Список с необязательным фильтром по категории (с её вложенными). */
  async list(page?: number, categoryId?: number | null): Promise<PaginatedResponse<ItemResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: {
        ...(page ? { page } : {}),
        ...(categoryId ? { category_id: categoryId } : {}),
      },
    })
    return result as unknown as PaginatedResponse<ItemResponse>
  }

  async get(id: number): Promise<ItemResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as ItemResponse
  }

  async create(data: ItemData): Promise<ItemResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as ItemResponse
  }

  async update(id: number, data: ItemData): Promise<ItemResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as ItemResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default ItemModule
