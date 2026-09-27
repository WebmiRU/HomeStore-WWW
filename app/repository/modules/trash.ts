import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

/** Строка корзины: удалённая запись в том виде, в каком её нужно показать. */
export type TrashEntry = {
  id: number
  /** Заголовок собран сервером: у единицы измерения их два, у прочих одно. */
  title: string
  deleted_at: string
  deleted_date: string | null
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
  /** Есть ли у раздела окончательное удаление: у пользователей нет. */
  can_purge: boolean
}

export type TrashRestoreResult = {
  restored: number
  /** Причины отказа по конкретным записям: название → причина. */
  failed: Record<string, string>
}

export type TrashPurgeResult = {
  purged: number
  titles: string[]
}

class TrashModule extends FetchFactory<any> {
  private readonly baseUrl = '/trash'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(section: string, page?: number): Promise<PaginatedResponse<TrashEntry>> {
    const result = await this.call('GET', `${this.baseUrl}/${section}`, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<TrashEntry>
  }

  async restore(section: string, ids: number[]): Promise<TrashRestoreResult> {
    const result = await this.call('POST', `${this.baseUrl}/${section}/restore`, { ids })
    return {
      restored: Number(result?.restored ?? 0),
      failed: result?.failed ?? {},
    }
  }

  /** Окончательное удаление — необратимое. */
  async purge(section: string, ids: number[]): Promise<TrashPurgeResult> {
    const result = await this.call('POST', `${this.baseUrl}/${section}/purge`, { ids })
    return { purged: Number(result?.purged ?? 0), titles: result?.titles ?? [] }
  }
}

export default TrashModule
