import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type UserProfileResponse = {
  id: number
  name: string
  email: string
  avatar_url: string | null
  /**
   * sha256 аватара: по нему берётся лёгкая миниатюра. Без него пришлось бы
   * грузить оригинал целиком.
   */
  avatar_sha: string | null
  /** Размеры аватара: нужны, чтобы не предлагать увеличенные варианты. */
  avatar_width: number | null
  avatar_height: number | null
  /** Пределы миниатюр аватара: см. ImageResponse.thumbs. */
  avatar_thumbs: { cover: number; contain: number } | null
  created_at: string
  updated_at: string
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

class UserProfileModule extends FetchFactory<any> {
  private readonly baseUrl = '/user'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<UserProfileResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<UserProfileResponse>
  }

  async all(): Promise<UserProfileResponse[]> {
    const result = await this.call('GET', `${this.baseUrl}/all`)
    return (result as any)?.data ?? result
  }

  async get(id: number): Promise<UserProfileResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as UserProfileResponse
  }

  async create(data: { name: string; email: string; password: string }): Promise<UserProfileResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as UserProfileResponse
  }

  async update(id: number, data: { name?: string; email?: string; password?: string }): Promise<UserProfileResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as UserProfileResponse
  }

  async updateAvatar(id: number, file: File): Promise<UserProfileResponse> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/${id}/avatar`, form)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as UserProfileResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default UserProfileModule
