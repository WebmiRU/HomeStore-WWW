import FetchFactory from '../factory'
import type { $Fetch } from 'ofetch'

export type ImageResponse = {
  id: number
  url: string
  sha256: string | null
  original_name: string | null
  mime: string | null
  /**
   * Размеры оригинала в пикселях: по ним клиент кладёт в srcset только те
   * варианты, которые не пришлось бы увеличивать, — браузер узнал бы об
   * этом лишь после загрузки, то есть уже заплатив лишние байты.
   */
  width: number | null
  height: number | null
  /** Вес оригинала в байтах. */
  size: number | null
  /**
   * Наибольшая сторона миниатюры по обрезке, которую ещё можно получить из
   * оригинала без увеличения. Считает сервер: клиент не должен угадывать, что
   * можно, а что нельзя, — он берёт ступени не выше этих чисел, а где ступени
   * не хватает, подставляет оригинал.
   */
  thumbs: { cover: number; contain: number } | null
  alt: string | null
  weight: number | null
  created_at: string | null
}

/** Ответ на загрузку файла: сама картинка и что с ней сделали. */
export type ImageUploadResult = {
  image: ImageResponse
  /**
   * Создана ли новая привязка. false — картинка уже была у сущности: в
   * список её добавлять нельзя, клиенту надо сказать об этом отдельно, иначе
   * тишина выглядит как сбой загрузки.
   */
  attached: boolean
  /** Сколько повторных привязок убрано, пока чистили дубли. */
  duplicatesRemoved: number
}

class ImageModule extends FetchFactory<any> {
  private readonly baseUrl = '/image'

  constructor(fetcher: $Fetch) {
    super(fetcher)
  }

  /**
   * Загрузка без привязки — для формы создания, где сущности ещё нет.
   *
   * Картинка появляется в базе сразу и ждёт владельца: при сохранении нового
   * предмета, склада или хранилища её id перечисляется в images, и она
   * привязывается. Если человек закрыл форму, картинка остаётся лишней —
   * такие убираются при обслуживании.
   */
  async uploadUnattached(file: File): Promise<ImageResponse> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', this.baseUrl, form)
    return ((result as any)?.data ?? result) as ImageResponse
  }

  async uploadForItem(itemId: number, file: File): Promise<ImageUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/item/${itemId}`, form)
    return this.unwrapUpload(result)
  }

  async uploadForStore(storeId: number, file: File): Promise<ImageUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/store/${storeId}`, form)
    return this.unwrapUpload(result)
  }

  /** Фото склада: снимок с парковки, по которому склад узнают. */
  async uploadForWarehouse(warehouseId: number, file: File): Promise<ImageUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/warehouse/${warehouseId}`, form)
    return this.unwrapUpload(result)
  }

  /** Фото категории: ею категория узнаётся в списке и в «Каталоге». */
  async uploadForCategory(categoryId: number, file: File): Promise<ImageUploadResult> {
    const form = new FormData()
    form.append('file', file)
    const result = await this.call('POST', `${this.baseUrl}/category/${categoryId}`, form)
    return this.unwrapUpload(result)
  }

  private unwrapUpload(result: any): ImageUploadResult {
    return {
      image: ((result as any)?.data ?? result) as ImageResponse,
      attached: (result as any)?.attached !== false,
      duplicatesRemoved: Number((result as any)?.duplicates_removed ?? 0),
    }
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

  async updateAltForWarehouse(warehouseId: number, imageId: number, alt: string | null): Promise<ImageResponse> {
    const result = await this.call('PATCH', `${this.baseUrl}/warehouse/${warehouseId}/image/${imageId}/alt`, { alt })
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ImageResponse
  }

  async updateAltForCategory(categoryId: number, imageId: number, alt: string | null): Promise<ImageResponse> {
    const result = await this.call('PATCH', `${this.baseUrl}/category/${categoryId}/image/${imageId}/alt`, { alt })
    const unwrapped = (result as any)?.data ?? result
    return unwrapped as ImageResponse
  }

  async reorderForItem(itemId: number, ids: number[]): Promise<void> {
    await this.call('POST', `${this.baseUrl}/item/${itemId}/image/reorder`, { ids })
  }

  async reorderForStore(storeId: number, ids: number[]): Promise<void> {
    await this.call('POST', `${this.baseUrl}/store/${storeId}/image/reorder`, { ids })
  }

  async reorderForWarehouse(warehouseId: number, ids: number[]): Promise<void> {
    await this.call('POST', `${this.baseUrl}/warehouse/${warehouseId}/image/reorder`, { ids })
  }

  async reorderForCategory(categoryId: number, ids: number[]): Promise<void> {
    await this.call('POST', `${this.baseUrl}/category/${categoryId}/image/reorder`, { ids })
  }

  async deleteForItem(itemId: number, imageId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/item/${itemId}/image/${imageId}`)
  }

  async deleteForCategory(categoryId: number, imageId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/category/${categoryId}/image/${imageId}`)
  }

  async deleteForStore(storeId: number, imageId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/store/${storeId}/image/${imageId}`)
  }

  async deleteForWarehouse(warehouseId: number, imageId: number): Promise<void> {
    await this.call('DELETE', `${this.baseUrl}/warehouse/${warehouseId}/image/${imageId}`)
  }
}

export default ImageModule