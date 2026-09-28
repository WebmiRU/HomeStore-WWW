/**
 * Миниатюры по размеру, в котором они видны на экране.
 *
 * Ключи миниатюр живут в таблице thumbnail, и набор задан миграцией
 * align_thumbnail_sizes_with_ui. Списки ниже обязаны совпадать с ней: неизвестный
 * ключ сервер отвергает (404), и клиент молча уходит в оригинал целиком.
 *
 * На каждое место в каталоге три строки — 1×, 1.5× и 2× от размера на экране.
 * Отдаём их в srcset, и браузер сам берёт ту, которая нужна его экрану: список
 * предметов на обычном мониторе тянет 38×38, на ретине — 76×76, и лишние
 * строки не грузятся. Раньше браузеру предлагался один вариант на все экраны,
 * и он брал либо мыло, либо вдвое больше байт, чем рисуется.
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

  /** Ключ под элемент размера cssSize с коэффициентом factor. */
  function thumbKeyFor(cssSize: number, factor = 1, crop: Crop = 'cover'): string {
    const needed = Math.max(1, Math.ceil(cssSize * factor))
    const sizes = crop === 'cover' ? COVER_SIZES : CONTAIN_SIZES
    const side = sizes.find((size) => size >= needed) ?? sizes[sizes.length - 1]!

    return `${side}x${side}_${crop}`
  }

  /** Список вариантов для srcset: «адрес ширина, …». */
  function thumbSrcset(image: ThumbSource | null | undefined, cssSize: number, crop: Crop = 'cover'): string {
    if (!image?.sha256) return ''

    const parts: string[] = []

    for (const factor of FACTORS) {
      const key = thumbKeyFor(cssSize, factor, crop)
      const side = Number(key.split('x')[0])
      const url = thumbUrl(image.sha256, key)

      if (!url || !worthIt(side, image, crop)) continue

      parts.push(`${url} ${crop === 'contain' ? containWidth(side, image) : side}w`)
    }

    return parts.join(', ')
  }

  /**
   * Адрес в src: самый маленький годный вариант, а если увеличивать нечего —
   * сам оригинал.
   *
   * src нужен всем, кто srcset не читает: почтовый клиент, отключённая загрузка
   * картинок, печать страницы. Пустой src там, где есть srcset, — это просто
   * пустая картинка.
   */
  function thumbUrlFor(
    image: ThumbSource | null | undefined,
    cssSize: number,
    crop: Crop = 'cover',
    originalUrl?: string | null,
  ): string | null {
    if (!image?.sha256) return originalUrl ?? null

    for (const factor of FACTORS) {
      const key = thumbKeyFor(cssSize, factor, crop)
      const side = Number(key.split('x')[0])

      if (!worthIt(side, image, crop)) continue

      return thumbUrl(image.sha256, key)
    }

    return originalUrl ?? null
  }

  return { apiOrigin, thumbUrl, thumbKeyFor, thumbSrcset, thumbUrlFor }
}

export type Crop = 'cover' | 'contain'

/** Что о картинке знает клиент: размеры приходят из API вместе с остальным. */
export interface ThumbSource {
  sha256?: string | null
  width?: number | null
  height?: number | null
}

/** Коэффициенты, которые отдаём в srcset: браузер выбирает сам. */
const FACTORS = [1, 1.5, 2]

/**
 * Стороны квадратных миниатюр по возрастанию — отдельно под каждую обрезку.
 *
 * Каждая сторона — потолок от «размер на экране × коэффициент» для одного из
 * мест интерфейса: 22 и 28 в дереве содержимого, 38 в списках, 56 в шапке,
 * 70 в поиске, 84 в карточке предмета, 120 в карточке пользователя и
 * производителя, 800 в просмотре фотографии, 80 в таблице изображений.
 *
 * Числа не круглые (33, 57, 105, 126…) — так вариант совпадает с тем, что
 * рисуется, и округление вверх не оставляет ни одного экрана с мылом.
 * Списки повторяют каталог из миграции один в один: править базу и их надо
 * вместе, иначе появится ключ, которого сервер не знает.
 */
const COVER_SIZES = [
  22, 28, 33, 38, 42, 44, 56, 57, 70, 76, 84, 105, 112, 120, 126, 140, 168, 180, 240,
]

/** Логотип вписывается, а не обрезается: края у логотипа и есть логотип. */
const CONTAIN_SIZES = [38, 57, 76, 80, 120, 160, 180, 240, 800, 1200, 1600]

/**
 * Увеличенный вариант не имеет смысла, если картинка меньше.
 *
 * Обрезка режет по меньшей стороне: квадрат 80×80 из фотографии 60×40 пришлось
 * бы растянуть по короткой стороне, и кадр размазался бы. Вписывание
 * уменьшает по большей: тут вариант полезен, пока картинка хоть немного
 * больше коробки.
 */
function worthIt(side: number, image: ThumbSource, crop: Crop): boolean {
  const width = image.width ?? 0
  const height = image.height ?? 0

  if (width === 0 || height === 0) {
    // Размеров нет (старая строка в базе): решаем по каталогу, как раньше.
    return true
  }

  return crop === 'cover' ? Math.min(width, height) >= side : Math.max(width, height) > side
}

/** Ширина файла вписывания: столько пикселей в нём по горизонтали. */
function containWidth(side: number, image: ThumbSource): number {
  const width = image.width ?? 0
  const height = image.height ?? 0

  if (width === 0 || height === 0) return side

  return Math.max(1, Math.round(width * Math.min(1, side / width, side / height)))
}
