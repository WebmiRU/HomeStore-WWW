import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type LabelPresetResponse = {
  id: number
  title: string
  page_width: number
  page_height: number
  page_margin_top: number
  page_margin_right: number
  page_margin_bottom: number
  page_margin_left: number
  cell_width: number
  cell_height: number
  cell_pad_top: number
  cell_pad_right: number
  cell_pad_bottom: number
  cell_pad_left: number
  barcode_position: 'left' | 'right' | 'top' | 'bottom'
  barcode_text_gap: number
  barcode_size: number
  font_id: number | null
  font_size_min: number
  font_size_max: number
  font_size_step: number
  line_height_factor: number
  created_at: string
  updated_at: string
  font?: {
    id: number
    name: string
    key: string
  } | null
}

export type LabelPresetCreateData = Partial<Omit<LabelPresetResponse, 'id' | 'created_at' | 'updated_at' | 'font'>>

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

class LabelPresetModule extends FetchFactory<any> {
  private readonly baseUrl = '/label-preset'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  async list(page?: number): Promise<PaginatedResponse<LabelPresetResponse>> {
    const result = await this.call('GET', this.baseUrl, undefined, {
      params: page ? { page } : undefined,
    })
    return result as unknown as PaginatedResponse<LabelPresetResponse>
  }

  async get(id: number): Promise<LabelPresetResponse> {
    const result = await this.call('GET', `${this.baseUrl}/${id}`)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as LabelPresetResponse
  }

  async create(data: LabelPresetCreateData): Promise<LabelPresetResponse> {
    const result = await this.call('POST', this.baseUrl, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as LabelPresetResponse
  }

  async update(id: number, data: LabelPresetCreateData): Promise<LabelPresetResponse> {
    const result = await this.call('PUT', `${this.baseUrl}/${id}`, data)
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as LabelPresetResponse
  }

  async delete(id: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/${id}`)
  }
}

export default LabelPresetModule
