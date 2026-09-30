/**
 * Миниатюры по размеру, в котором они видны на экране.
 *
 * Ключи миниатюр живут в таблице thumbnail, и набор задан миграцией
 * align_thumbnail_sizes_with_ui. Списки ниже обязаны совпадать с ней: неизвестный
 * ключ сервер отвергает (404), и клиент молча уходит в оригинал целиком.
 *
 * На каждое место в каталоге три строки — 1×, 1.5× и 2× от размера на экране.
 * Отдаём их в srcset, и браузер сам берёт ту, которая нужна его экрану.
 *
 * Увеличенного ничего не бывает: где нужного размера из оригинала не получить,
 * в список встаёт сам оригинал, и на этом список заканчивается. Предел
 * считает сервер (image.thumbs) — из картинки 90×60 нельзя сделать квадрат 120,
 * и растянутая копия была бы не картинкой, а её бледным подобием.
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

  /** Наибольшая сторона, доступная из этой картинки по данной обрезке. */
  function limitFor(image: ThumbSource | null | undefined, crop: Crop): number | null {
    const fromServer = image?.thumbs?.[crop]

    if (fromServer != null) return fromServer

    // Предел не пришёл (старая строка в базе): считаем на клиенте по размерам,
    // чтобы srcset не опустел из-за одной непрочитанной строки.
    const width = image?.width ?? 0
    const height = image?.height ?? 0

    if (width === 0 || height === 0) return null

    return crop === 'cover' ? Math.min(width, height) : Math.max(width, height)
  }

  /** Ступень лестницы под нужный размер, либо null, если её нет. */
  function stepFor(cssSize: number, factor: number, crop: Crop): number | null {
    const needed = Math.max(1, Math.ceil(cssSize * factor))
    const sizes = crop === 'cover' ? COVER_SIZES : CONTAIN_SIZES

    return sizes.find((size) => size >= needed) ?? null
  }

  /** Ключ миниатюры под элемент размера cssSize с коэффициентом factor. */
  function thumbKeyFor(cssSize: number, factor = 1, crop: Crop = 'cover'): string {
    const side = stepFor(cssSize, factor, crop)

    if (side === null) throw new Error(`Нет размера миниатюры для ${cssSize}px ×${factor} (${crop})`)

    return `${side}x${side}_${crop}`
  }

  /**
   * Список вариантов для srcset: «адрес ширина, …».
   *
   * Рекомендация идёт с прочерком: браузер сам выберет по экрану и плотности
   * пикселей. Последним в списке стоит либо самая крупная доступная миниатюра,
   * либо оригинал — если нужного размера из картинки не получить.
   */
  function thumbSrcset(
    image: ThumbSource | null | undefined,
    cssSize: number,
    crop: Crop = 'cover',
    originalUrl?: string | null,
  ): string {
    if (!image?.sha256) return ''

    const limit = limitFor(image, crop)
    const parts: string[] = []

    for (const factor of FACTORS) {
      const side = stepFor(cssSize, factor, crop)
      const url = side === null ? null : thumbUrl(image.sha256, `${side}x${side}_${crop}`)

      if (url && (limit === null || side <= limit)) {
        parts.push(`${url} ${crop === 'contain' ? containWidth(side, image) : side}w`)
        continue
      }

      // Нужного размера из оригинала не сделать: дальше идти незачем, всё
      // следующее ещё крупнее. Оригинал — это и есть потолок.
      if (originalUrl) parts.push(`${originalUrl} ${intrinsicWidth(image, crop)}w`)

      break
    }

    return parts.join(', ')
  }

  /**
   * Адрес в src: самая мелкая доступная миниатюра, а если ни одной нет —
   * оригинал.
   *
   * src нужен всем, кто srcset не читает: почтовый клиент, отключённая загрузка
   * картинок, печать страницы. Пустой src там, где есть srcset, — просто пустая
   * картинка.
   */
  function thumbUrlFor(
    image: ThumbSource | null | undefined,
    cssSize: number,
    crop: Crop = 'cover',
    originalUrl?: string | null,
  ): string | null {
    if (!image?.sha256) return originalUrl ?? null

    const limit = limitFor(image, crop)

    for (const factor of FACTORS) {
      const side = stepFor(cssSize, factor, crop)
      const url = side === null ? null : thumbUrl(image.sha256, `${side}x${side}_${crop}`)

      if (url && (limit === null || side <= limit)) return url
    }

    return originalUrl ?? null
  }

  /**
   * Считает все три атрибута разом: src, srcset и sizes.
   *
   * Считать их по отдельности нельзя: sizes — обещание браузеру, сколько
   * пикселей достанется картинке, и браузер растягивает файл ровно до него.
   * Обещаем 800, отдать можно 473 — получится мыло вместо фотографии. Поэтому
   * обещание ограничивается тем, что есть: min(обещанное, лучшее из
   * имеющегося).
   */
  function thumbVariants(
    image: ThumbSource | null | undefined,
    cssSize: number,
    crop: Crop = 'cover',
    originalUrl?: string | null,
    sizesHint?: string,
  ): { src: string | null; srcset: string; sizes: string } {
    const base = sizesHint ?? `${Math.round(cssSize)}px`

    if (!image?.sha256) {
      return { src: originalUrl ?? null, srcset: '', sizes: base }
    }

    const limit = limitFor(image, crop)
    const candidates: { url: string; width: number }[] = []

    const pushOriginal = (): void => {
      if (!originalUrl) return

      const width = intrinsicWidth(image, crop)

      if (width > 0) candidates.push({ url: originalUrl, width })
    }

    for (const factor of FACTORS) {
      const side = stepFor(cssSize, factor, crop)
      const url = side === null ? null : thumbUrl(image.sha256, `${side}x${side}_${crop}`)

      if (url && (limit === null || side <= limit)) {
        candidates.push({ url, width: crop === 'contain' ? containWidth(side, image) : side })
        continue
      }

      // Нужного размера из оригинала не сделать: дальше идти незачем, всё
      // следующее ещё крупнее. Оригинал — это и есть потолок.
      pushOriginal()

      break
    }

    if (candidates.length === 0) {
      pushOriginal()
    }

    const widest = candidates.reduce((max, item) => Math.max(max, item.width), 0)

    return {
      src: candidates[0]?.url ?? null,
      srcset: candidates.map((item) => `${item.url} ${item.width}w`).join(', '),
      sizes: widest > 0 ? `min(${base}, ${Math.round(widest)}px)` : base,
    }
  }

  return { apiOrigin, thumbUrl, thumbKeyFor, thumbSrcset, thumbUrlFor, thumbVariants }
}

export type Crop = 'cover' | 'contain'

/** Что о картинке знает клиент: размеры и пределы приходят из API. */
export interface ThumbSource {
  sha256?: string | null
  width?: number | null
  height?: number | null
  thumbs?: { cover: number; contain: number } | null
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
  22, 28, 33, 38, 42, 44, 56, 57, 70, 76, 84, 105, 112, 120, 126, 140, 168, 180, 200,
  240, 300, 400,
]

/** Логотип вписывается, а не обрезается: края у логотипа и есть логотип. */
const CONTAIN_SIZES = [38, 57, 76, 80, 120, 160, 180, 200, 240, 300, 400, 800, 1200, 1600]

/** Ширина файла вписывания: столько пикселей в нём по горизонтали. */
function containWidth(side: number, image: ThumbSource): number {
  const width = image.width ?? 0
  const height = image.height ?? 0

  if (width === 0 || height === 0) return side

  return Math.max(1, Math.round(width * Math.min(1, side / width, side / height)))
}

/**
 * Ширина оригинала для srcset.
 *
 * Объявляем свою, а не сторону коробки: по объявлению браузер понимает, сколько
 * пикселей в файле, и выбирает сам. У обрезанного кадра размер по ширине —
 * это меньшая сторона оригинала, из неё берётся квадрат.
 */
function intrinsicWidth(image: ThumbSource, crop: Crop): number {
  const width = image.width ?? 0
  const height = image.height ?? 0

  if (width === 0 || height === 0) return 0

  return crop === 'cover' ? Math.min(width, height) : width
}
