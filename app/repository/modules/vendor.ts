import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'
import type { UserBrief } from './code'

/** Короткая ссылка на производителя — как её отдают вперемешку с предметом. */
export type VendorBrief = {
  id: number
  title: string
  /** Поставщик удалён мягко: название показываем с пометкой, но не ссылкой. */
  deleted?: boolean
}

export type VendorResponse = {
  id: number
  user_id: number
  user?: UserBrief | null
  title: string
  description: string | null
  logo_id: number | null
  /** Адрес оригинала. */
  logo_url: string | null
  /** sha256 логотипа: по нему берётся лёгкая миниатюра. */
  logo_sha: string | null
  created_at: string
  updated_at: string
}

export type VendorData = {
  title?: string
  description?: string | null
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

class VendorModule extends FetchFactory<any> {
  private readonly baseUrl = '/vendor'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<VendorResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<VendorResponse>
  }

  /** Все производители без постраничного обрезания — для селектов. */
  async all(): Promise<VendorResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<VendorResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    return ((result as any)?.data ?? result) as VendorResponse
  }

  async create(data: VendorData): Promise<VendorResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return ((result as any)?.data ?? result) as VendorResponse
  }

  async update(id: number, data: VendorData): Promise<VendorResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    return ((result as any)?.data ?? result) as VendorResponse
  }

  /** Загрузка логотипа. Файл уходит на сервер тем же путём, что и фото. */
  async uploadLogo(id: number, file: File): Promise<VendorResponse> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/${id}/logo`, form)
    return ((result as any)?.data ?? result) as VendorResponse
  }

  async deleteLogo(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}/logo`)
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default VendorModule
