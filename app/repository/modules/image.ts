import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type ImageResponse = {
  id: number
  url: string
  sha256: string | null
  original_name: string | null
  mime: string | null
  alt: string | null
  weight: number | null
  created_at: string | null
}

class ImageModule extends FetchFactory<any> {
  private readonly baseUrl = '/image'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async uploadForItem(itemId: number, file: File): Promise<ImageResponse> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/item/${itemId}`, form)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ImageResponse
  }

  async uploadForStore(storeId: number, file: File): Promise<ImageResponse> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/store/${storeId}`, form)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ImageResponse
  }

  async updateAltForItem(itemId: number, imageId: number, alt: string | null): Promise<ImageResponse> {
    const result = await this.call('PATCH', `${this.baseUrl}/item/${itemId}/image/${imageId}/alt`, { alt })
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ImageResponse
  }

  async updateAltForStore(storeId: number, imageId: number, alt: string | null): Promise<ImageResponse> {
    const result = await this.call('PATCH', `${this.baseUrl}/store/${storeId}/image/${imageId}/alt`, { alt })
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ImageResponse
  }

  async reorderForItem(itemId: number, ids: number[]): Promise<void> {
    await this.call('POST', `${this.baseUrl}/item/${itemId}/image/reorder`, { ids })
  }

  async reorderForStore(storeId: number, ids: number[]): Promise<void> {
    await this.call('POST', `${this.baseUrl}/store/${storeId}/image/reorder`, { ids })
  }

  async deleteForItem(itemId: number, imageId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/item/${itemId}/image/${imageId}`)
  }

  async deleteForStore(storeId: number, imageId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/store/${storeId}/image/${imageId}`)
  }
}

export default ImageModule