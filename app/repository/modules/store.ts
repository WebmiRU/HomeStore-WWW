import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { ImageResponse } from './image'
import type { UserBrief } from './code'
import type { AccessRight } from './access'

export type StoreParent = {
  id: number
  title: string
  parent_id: number | null
  created_at: string
  updated_at: string
}

export type StoreResponse = {
  id: number
  user_id?: number | null
  user?: UserBrief | null
  rights?: AccessRight[]
  is_owner?: boolean
  can_create?: boolean
  can_edit?: boolean
  can_delete?: boolean
  title: string
  title_print: string | null
  parent_id: number | null
  warehouse_id?: number | null
  /** Склад удалён мягко: название показываем с пометкой, сменить можно только на живой. */
  warehouse?: { id: number; title: string; deleted?: boolean } | null
  created_at: string
  updated_at: string
  parents: StoreParent[]
  code?: string | null
  images?: ImageResponse[] | null
}

/** Предмет в узле дерева содержимого. */
export type ContentsItem = {
  id: number
  title: string
}

/**
 * Узел дерева содержимого.
 *
 * Три счётчика, а не один: items_count — сколько лежит прямо в узле,
 * items_hidden — сколько из них спрятано под «показать все», items_total —
 * сколько во всём поддереве. По одному числу не отличить «здесь ничего не
 * лежит, всё в детях» от «здесь пусто вообще».
 */
export type ContentsNode = {
  id: number
  title: string
  kind: 'store' | 'warehouse'
  /** Хранилище удалено мягко: предметы в нём живые, поэтому узел остаётся. */
  deleted: boolean
  items_count: number
  items: ContentsItem[]
  items_hidden: number
  items_total: number
  children: ContentsNode[]
}

class StoreModule extends FetchFactory<any> {
  private readonly baseUrl = '/store'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(): Promise<StoreResponse[]> {
    // store/all отдаёт все записи без пагинации (удобно для построения дерева)
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  /** Дерево содержимого хранилища: вложенные хранилища и предметы. */
  async contents(id: number): Promise<ContentsNode> {
    const result = await this.call('GET', `${this.baseUrl}/${id}/contents`)
    return ((result as any)?.data ?? result) as ContentsNode
  }

  /** Все предметы хранилища — для кнопки «показать все» под списком. */
  async contentsItems(id: number): Promise<ContentsItem[]> {
    const result = await this.call('GET', `${this.baseUrl}/${id}/contents/items`)
    return ((result as any)?.data ?? result) as ContentsItem[]
  }

  async get(id: number): Promise<StoreResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as StoreResponse
  }

  async create(data: { title: string; title_print?: string | null; parent_id?: number | null; warehouse_id?: number | null; code?: string | null }): Promise<StoreResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as StoreResponse
  }

  async update(id: number, data: { title?: string; title_print?: string | null; parent_id?: number | null; warehouse_id?: number | null; code?: string | null }): Promise<StoreResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as StoreResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default StoreModule
