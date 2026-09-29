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

/**
 * Настройка частичного списания: одно расходуемое свойство предмета.
 *
 * Само значение свойства — это норма на одну штуку. Здесь — как эта норма
 * расходуется: с каким шагом по умолчанию, в каком порядке предлагается в
 * строке операции и является ли его обнуление поводом списать предмет целиком.
 */
export type ItemPartialPropertyInput = {
  property_id: number
  step?: number | null
  is_full_reason?: boolean
  sort?: number | null
}

/** Расходуемое свойство в ответе сервера, вместе с остатками. */
export type ItemPartialPropertyResponse = {
  property_id: number
  property_title?: string | null
  step: number
  is_full_reason: boolean
  sort: number
  /** Норма на одну штуку. */
  norm: number
  /** Сколько осталось внутри текущей штуки. */
  remaining: number
  /** Сколько осталось всего, со всеми целыми штуками. */
  total: number
  /** Сколько можно списать прямо сейчас: не больше общего остатка. */
  available: number
}

export type ItemData = Partial<ItemPayload> & {
  codes?: string[]
  category_id?: number | null
  vendor_id?: number | null
  properties?: ItemPropertyInput[]
  partial_properties?: ItemPartialPropertyInput[]
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
  /**
   * Расходуемые свойства с остатками. Пустой массив — обычный предмет, он
   * списывается штуками. Есть только у карточки и ответа на сохранение.
   */
  partial?: ItemPartialPropertyResponse[]
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

  /**
   * Список с необязательными фильтрами.
   *
   * Фильтр по категории берёт и её вложенные, по производителю — ровно его
   * предметы: вложенности у производителей нет.
   */
  async list(
    page?: number,
    categoryId?: number | null,
    vendorId?: number | null,
  ): Promise<PaginatedResponse<ItemResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: {
        ...(page ? { page } : {}),
        ...(categoryId ? { category_id: categoryId } : {}),
        ...(vendorId ? { vendor_id: vendorId } : {}),
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
