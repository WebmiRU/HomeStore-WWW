import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type LoginResponse = {
  token: string
  user: {
    id: number
    name: string
    email: string
    avatar_url: string | null
    created_at: string
    updated_at: string
  }
}

class AuthModule extends FetchFactory<any> {
  private readonly baseUrl = '/login'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async login(data: { email: string; password: string }): Promise<LoginResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    return result as unknown as LoginResponse
  }

  async logout(): Promise<void> {
    await this.call('POST', '/logout')
  }
}

export default AuthModule