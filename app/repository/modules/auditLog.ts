import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type AuditActor = {
  id: number
  name: string
  email: string
}

export type AuditLogEntry = {
  id: number
  action: string
  entity_type: string | null
  entity_id: number | null
  owner_id: number | null
  actor: AuditActor | null
  payload: Record<string, any>
  created_at: string
}

export type AuditLogFilters = {
  page?: number
  per_page?: number
  action?: string
  entity_type?: string
  entity_id?: number
  date_from?: string
  date_to?: string
}

export type AuditLogStatsPoint = {
  bucket: string | null
  key: string | null
  count: number
}

export type AuditLogStatsParams = {
  group_by: 'action' | 'entity' | 'day' | 'day,action' | 'day,entity'
  granularity?: 'hour' | 'day'
  entity_type?: string
  entity_id?: number
  date_from?: string
  date_to?: string
}

export type AuditLogBalancePoint = {
  at: string
  qty: number
}

/** Остаток одного расходуемого свойства во времени. */
export type AuditLogBalanceSeries = {
  property_id: number
  title: string
  points: AuditLogBalancePoint[]
}

export type AuditLogBalance = {
  /** Остаток штук предмета. */
  points: AuditLogBalancePoint[]
  /** Остатки по свойствам — у обычного предмета пусто. */
  series: AuditLogBalanceSeries[]
}

export type AuditLogBalanceParams = {
  entity_type: string
  entity_id: number
  date_from?: string
  date_to?: string
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

class AuditLogModule extends FetchFactory<any> {
  private readonly baseUrl = '/audit-log'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(filters: AuditLogFilters): Promise<PaginatedResponse<AuditLogEntry>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: { ...filters },
    })
    return result as unknown as PaginatedResponse<AuditLogEntry>
  }

  async stats(params: AuditLogStatsParams): Promise<AuditLogStatsPoint[]> {
    const result = await this.call('GET', `${this.baseUrl}/stats`, undefined, {
      params: { ...params },
    })
    const unwrapped = (result as any)?.data ?? result
    return (Array.isArray(unwrapped) ? unwrapped : []) as AuditLogStatsPoint[]
  }

  /**
   * Ряд остатков: по штукам предмета и, если он расходуется частями, по
   * каждому расходуемому свойству.
   *
   * Серии по свойствам приходят отдельно и в общий ряд не входят: количество
   * штук у такого предмета почти не меняется, и график по нему сказал бы
   * «ничего не происходило», хотя расход был.
   */
  async balance(params: AuditLogBalanceParams): Promise<AuditLogBalance> {
    const result = await this.call('GET', `${this.baseUrl}/balance`, undefined, {
      params: { ...params },
    })
    const unwrapped = (result as any)?.data ?? result

    return {
      points: (Array.isArray(unwrapped) ? unwrapped : []) as AuditLogBalancePoint[],
      series: ((result as any)?.series ?? []) as AuditLogBalanceSeries[],
    }
  }
}

export default AuditLogModule