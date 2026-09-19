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

  async balance(params: AuditLogBalanceParams): Promise<AuditLogBalancePoint[]> {
    const result = await this.call('GET', `${this.baseUrl}/balance`, undefined, {
      params: { ...params },
    })
    const unwrapped = (result as any)?.data ?? result
    return (Array.isArray(unwrapped) ? unwrapped : []) as AuditLogBalancePoint[]
  }
}

export default AuditLogModule