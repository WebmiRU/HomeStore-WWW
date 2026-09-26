<template>
  <div v-if="src && !failed" class="item-photo-wrap" :style="frameStyle">
    <span v-if="loading" class="item-photo-spinner" aria-hidden="true" />
    <img
      class="item-photo"
      :class="{ 'item-photo--loading': loading }"
      :src="src"
      :alt="alt ?? ''"
      loading="lazy"
      @load="onLoad"
      @error="onError"
    />
  </div>
  <ItemPhotoPlaceholder v-else :size="size" />
</template>

<script setup lang="ts">
import type { ImageResponse } from '~/repository/modules/image'

const props = defineProps<{
  images?: ImageResponse[] | null
  alt?: string | null
  /**
   * Явный размер в CSS-пикселях. Без него размер берётся из стилей: 84px, а на
   * узком экране 56px. С размером — как есть, в том числе на узком экране: в
   * ячейке таблицы картинка мельче не становится, иначе строка схлопывается.
   */
  size?: number | null
}>()

const { thumbUrl } = useThumbnail()

const THUMB_KEY = '100x100_cover'

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
  return [...new Set([thumbUrl(img.sha256, THUMB_KEY) ?? img.url, img.url])]
})

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
