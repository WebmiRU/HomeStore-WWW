<template>
  <!--
    Обёртка становится кнопкой только когда включён просмотр: в строке
    сканирования и в диалогах фото — часть карточки, и клик по ней должен
    выбирать предмет, а не открывать модалку.
  -->
  <component
    :is="lightbox ? 'button' : 'div'"
    v-if="src && !failed"
    class="item-photo-wrap"
    :class="{ 'item-photo-wrap--openable': lightbox }"
    :style="frameStyle"
    :type="lightbox ? 'button' : undefined"
    :aria-label="lightbox ? t('item_photo.open', { alt: alt ?? '' }) : undefined"
    @click="openViewer"
  >
    <span v-if="loading" class="item-photo-spinner" aria-hidden="true" />
    <img
      class="item-photo"
      :class="{ 'item-photo--loading': loading }"
      :src="variants.src"
      :srcset="variants.srcset"
      :sizes="variants.sizes"
      :alt="alt ?? ''"
      loading="lazy"
      @load="onLoad"
      @error="onError"
    />
  </component>
  <ItemPhotoPlaceholder v-else :size="size" />

  <ImageLightbox v-if="viewerOpen" :images="lightboxImages" @close="viewerOpen = false" />
</template>

<script setup lang="ts">
import type { ImageResponse } from '~/repository/modules/image'

const { t } = useI18n()
const props = defineProps<{
  images?: ImageResponse[] | null
  alt?: string | null
  /**
   * Явный размер в CSS-пикселях. Без него размер берётся из стилей: 84px, а на
   * узком экране 56px. С размером — как есть, в том числе на узком экране: в
   * ячейке таблицы картинка мельче не становится, иначе строка схлопывается.
   */
  size?: number | null
  /**
   * Открывать ли фото по клику в просмотре крупным кадром. Включается в
   * индексных таблицах, где фото стоит в строке списка и клик по строке
   * ничего не делает.
   */
  lightbox?: boolean
}>()

const { thumbUrlFor, thumbVariants } = useThumbnail()

/**
 * Без явного размера фото занимает 84px — столько оно и рисуется.
 *
 * Размер подсказывает, какие варианты класть в srcset; выбирает из них
 * браузер по своему экрану. Поэтому он должен быть равен ширине элемента в
 * css-пикселях, а не округлённому «на глаз» числу: при 40 вместо 38 лестница
 * брала следующую ступень и клала в список файл больше нужного.
 */
const DEFAULT_SIZE = 84

const cssSize = computed(() => props.size ?? DEFAULT_SIZE)

/**
 * Сколько ждать картинку, прежде чем перестать ждать.
 *
 * Спиннер без предела — это не спиннер, а пустое место: запрос к хранилищу
 * изредка не обрывается ошибкой, а просто висит, и картинка не приходит и не
 * не приходит никогда. Раньше это стоило минуту на запрос, а в списке предметов
 * таких запросов сразу десять.
 *
 * Восемь секунд на миниатюру — с большим запасом: она весит несколько
 * килобайт и по сети приходит за доли секунды, так что ожидание означает не
 * медленную сеть, а зависшую.
 */
const WAIT_MS = 8000

const failed = ref(false)
const loading = ref(true)
const attempt = ref(0)
const viewerOpen = ref(false)

/** Просмотр крупным кадром. Список фото целиком: их может быть несколько. */
/**
 * В модалку уходит та же картинка, что и в списке, целиком: размеры и пределы
 * нужны и там. Раньше объект пересобирался из трёх полей, и модалка решала,
 * какие размеры доступны, вслепую — предлагала 800, 1200 и 1600 даже там, где
 * оригинал мельче.
 */
const lightboxImages = computed(() => props.images ?? [])

function openViewer() {
  if (!props.lightbox) return

  viewerOpen.value = true
}

const first = computed<ImageResponse | null>(() => (props.images ?? [])[0] ?? null)

/**
 * Что пробуем по порядку: сперва миниатюра, потом — оригинал целиком.
 *
 * Второй адрес на случай, если миниатюра не получилась: в таблице это
 * дорого, но картинка лучше, чем заглушка.
 */
const candidates = computed<string[]>(() => {
  const img = first.value
  if (!img) return []
  return [...new Set([thumbUrlFor(img, cssSize.value, 'cover', img.url) ?? '', img.url ?? ''])].filter(
    (url) => url !== '',
  )
})

/**
 * Три варианта по ширине, которую браузер сам сопоставит со своим экраном.
 * Сколько именно пикселей достанется картинке — его дело, а не наше: список
 * предметов на обычном мониторе берёт 38×38, на ретине — 76×76.
 */
/**
 * Размер, srcset и src считаются одним куском: обещание в sizes не должно
 * превышать того, что есть в файлах, иначе браузер растянет картинку.
 */
const variants = computed(() =>
  thumbVariants(first.value, cssSize.value, 'cover', first.value?.url ?? null),
)

const src = computed<string | null>(() => candidates.value[attempt.value] ?? null)

let timer: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/** Отказ от текущего адреса: следующий по списку, а если он последний — заглушка. */
function giveUp() {
  stopWaiting()

  if (attempt.value < candidates.value.length - 1) {
    attempt.value += 1
    return
  }

  loading.value = false
  failed.value = true
}

const frameStyle = computed(() => {
  if (props.size == null) return undefined
  const px = `${props.size}px`
  return {
    width: px,
    height: px,
    // Скругление и спиннер ведём за размером. У 84px полоса 8px и колесо 22px;
    // на 40px те же 8px читаются как кнопка, а 22px не влезает в ячейку.
    borderRadius: `${Math.max(3, Math.round(props.size / 10))}px`,
    '--photo-spinner': `${Math.max(10, Math.round(props.size / 4))}px`,
  }
})

watch(
  src,
  (url) => {
    stopWaiting()
    loading.value = true
    failed.value = false
    if (url !== null) {
      timer = setTimeout(giveUp, WAIT_MS)
    }
  },
  { immediate: true },
)

onBeforeUnmount(stopWaiting)

function onLoad() {
  stopWaiting()
  loading.value = false
}

function onError() {
  giveUp()
}
</script>

<style scoped>
.item-photo-wrap {
  position: relative;
  display: block;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid #333;
  border-radius: 8px;
  background: #222;
}

.item-photo {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: opacity 0.15s ease;
}

.item-photo--loading {
  opacity: 0;
}

/* Кнопка-просмотр: с рамкой и фоном фото она выглядит тем же блоком, что и
   обычная обёртка, и отличается только курсором. */
.item-photo-wrap--openable {
  display: block;
  padding: 0;
  cursor: zoom-in;
}

.item-photo-wrap--openable:hover {
  border-color: #4a7a4a;
}

.item-photo-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--photo-spinner, 22px);
  height: var(--photo-spinner, 22px);
  margin: calc(var(--photo-spinner, 22px) / -2) 0 0 calc(var(--photo-spinner, 22px) / -2);
  border: 2px solid #444;
  border-top-color: #9fd8a6;
  border-radius: 50%;
  animation: item-photo-spin 0.7s linear infinite;
}

@keyframes item-photo-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .item-photo-wrap {
    width: 56px;
    height: 56px;
  }
}
</style>
