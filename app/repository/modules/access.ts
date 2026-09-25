import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from '~/composables/useCurrentUser'

export type AccessRight = 'view' | 'create' | 'edit' | 'delete'

export type AccessGrantResponse = {
  id: number
  entity_type: string
  entity_id: number | null
  warehouse: { id: number; title: string } | null
  user: UserBrief | null
  rights: AccessRight[]
  created_at: string
  updated_at: string
}

class AccessModule extends FetchFactory<any> {
  private readonly baseUrl = '/access'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(): Promise<AccessGrantResponse[]> {
    const result = await this.call('GET', this.baseUrl)
    return (result as any)?.data ?? result
  }

  async forWarehouse(warehouseId: number): Promise<AccessGrantResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/warehouse/${warehouseId}`)
    return (result as any)?.data ?? result
  }

  async create(data: { warehouse_id: number; user_id: number; rights: AccessRight[] }): Promise<AccessGrantResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as AccessGrantResponse
  }

  async update(id: number, data: { rights: AccessRight[] }): Promise<AccessGrantResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as AccessGrantResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default AccessModule