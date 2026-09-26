import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from './code'
import type { DictionaryResponse } from './dictionary'
import type { PropertyGroupResponse } from './propertyGroup'
import type { UnitResponse } from './unit'

/**
 * Типы свойств в том виде, в каком их отдаёт сервер. Набор закрытый:
 * сервер валидирует `type` по этому же списку, и лишнее значение в интерфейсе
 * только сбивало бы с толку.
 */
export const PROPERTY_TYPES = ['string', 'int', 'float', 'bool', 'dictionary'] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  string: 'Текст',
  int: 'Целое число',
  float: 'Дробное число',
  bool: 'Да/Нет',
  dictionary: 'Из справочника',
}

/** Единица измерения бывает только у числового свойства. */
export function propertyAcceptsUnit(type: PropertyType | '' | null | undefined): boolean {
  return type === 'int' || type === 'float'
}

/** Справочник бывает только у свойства типа «Из справочника». */
export function propertyNeedsDictionary(type: PropertyType | '' | null | undefined): boolean {
  return type === 'dictionary'
}

export type PropertyResponse = {
  id: number
  user_id: number
  user?: UserBrief | null
  title: string
  type: PropertyType
  /** Готовое название типа для показа: сервер отдаёт его вместе со значением. */
  type_label: string
  group_id: number | null
  group?: PropertyGroupResponse | null
  unit_id: number | null
  unit?: UnitResponse | null
  dictionary_id: number | null
  dictionary?: DictionaryResponse | null
  created_at: string
  updated_at: string
}

export type PropertyData = {
  title?: string
  type?: PropertyType
  group_id?: number | null
  unit_id?: number | null
  dictionary_id?: number | null
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

class PropertyModule extends FetchFactory<any> {
  private readonly baseUrl = '/property'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<PropertyResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<PropertyResponse>
  }

  async all(): Promise<PropertyResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<PropertyResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as PropertyResponse
  }

  async create(data: PropertyData): Promise<PropertyResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as PropertyResponse
  }

  async update(id: number, data: PropertyData): Promise<PropertyResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as PropertyResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default PropertyModule
