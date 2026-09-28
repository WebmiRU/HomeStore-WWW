/**
 * Способы взять миниатюру по размеру, который она занимает на экране.
 *
 * Ключи миниатюр живут в таблице thumbnail, и набор задан миграциями. Лестница
 * ниже обязана совпадать с ней: неизвестный ключ сервер отвергает (404), и
 * клиент молча уходит в оригинал целиком.
 */
export function useThumbnail() {
  const config = useRuntimeConfig()

  function apiOrigin(): string {
    const base = String(config.public.apiBaseUrl ?? '')
    if (import.meta.dev && import.meta.client) {
      return `${window.location.protocol}//${window.location.hostname}`
    }
    return base.replace(/\/+$/, '')
  }

  function thumbUrl(sha256: string | null | undefined, key: string): string | null {
    if (!sha256) return null
    return `${apiOrigin()}/image/${key}/${sha256}`
  }

  return { apiOrigin, thumbUrl, thumbKeyFor: thumbKeyFor }
}

/**
 * Стороны квадратных миниатюр по возрастанию: 50, 60, 100, 150, 200, 250, 800.
 *
 * Ровно те, что заводит миграция с миниатюрами (add_small_thumbnails и её
 * предшественницы). Правку каталога в базе и правку лестницы здесь надо
 * делать вместе.
 */
const THUMB_SIZES = [50, 60, 100, 150, 200, 250, 800]

/**
 * Ключ миниатюры под элемент размера cssSize.
 *
 * Берётся наименьшая лестница, которая не меньше удвоенного размера на
 * экране: на ретине пикселя вдвое больше, и брать «в размер» — значит
 * загрузить вдвое больше данных, чем рисуется, либо получить мыло.
 *
 * Раньше всё тянуло 100x100, и в дереве содержимого, где миниатюра занимает
 * 22–28 пикселей, это было в четыре с половиной раза больше нужного.
 */
export function thumbKeyFor(cssSize: number, crop: 'cover' | 'contain' = 'cover'): string {
  const needed = Math.max(1, Math.round(cssSize)) * 2
  const side = THUMB_SIZES.find((size) => size >= needed) ?? THUMB_SIZES[THUMB_SIZES.length - 1]!

  return `${side}x${side}_${crop}`
}
