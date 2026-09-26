<template>
  <span class="m-logo" :style="{ width: px, height: px }" :title="title">
    <!-- Спиннер показывается, пока не пришла картинка: смена логотипа
         оставляет рамку с буквой-заглушкой на всё время запроса, и без
         индикатора не видно, идёт загрузка или она уже отвалилась. -->
    <span v-if="src && loading" class="m-logo__spinner" aria-hidden="true" />
    <img
      v-if="src"
      :src="src"
      :alt="title || 'Логотип'"
      :class="{ 'm-logo__img--loading': loading }"
      class="m-logo__img"
      @load="onLoad"
      @error="onError"
    />
    <span v-else class="m-logo__fallback" :style="fallbackStyle">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    logoUrl?: string | null
    logoSha?: string | null
    title?: string | null
    size?: number
    thumbKey?: string
  }>(),
  {
    // contain, а не cover: логотип обычно широкий, и обрезка съедала бы
    // его по краям вместе с частью названия.
    thumbKey: '100x100_contain',
    size: 40,
  },
)

const { thumbUrl } = useThumbnail()

/**
 * Сколько ждать картинку, прежде чем перестать ждать.
 *
 * Спиннер без предела — это не спиннер, а пустое место: запрос к хранилищу
 * изредка не обрывается ошибкой, а просто висит, и картинка не приходит
 * совсем. Восемь секунд на миниатюру — с большим запасом: она весит
 * несколько килобайт и приходит за доли секунды.
 */
const WAIT_MS = 8000

const failed = ref(false)
const loading = ref(false)
const attempt = ref(0)

/**
 * Что пробуем по порядку: сперва миниатюра, потом — оригинал целиком.
 *
 * Второй адрес на случай, если миниатюра не получилась: логотип лучше
 * тяжёлой картинки, чем заглушка с буквой.
 */
const candidates = computed<string[]>(() => {
  const thumb = thumbUrl(props.logoSha, props.thumbKey)

  return [...new Set([thumb, props.logoUrl ?? ''].filter((url) => url !== ''))]
})

// После неудачи адреса src становится пустым: браузер показал бы битую
// картинку, а заглушка с буквой читается как «логотипа нет».
const src = computed<string | null>(() =>
  failed.value ? null : (candidates.value[attempt.value] ?? null),
)

let timer: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/** Смена логотипа: сбросить попытки и снова показать спиннер. */
watch(
  () => `${props.logoSha ?? ''}|${props.logoUrl ?? ''}`,
  () => {
    stopWaiting()
    failed.value = false
    attempt.value = 0
    loading.value = src.value !== null
  },
  { immediate: true },
)

watch(loading, (value) => {
  stopWaiting()

  if (value) {
    timer = setTimeout(giveUp, WAIT_MS)
  }
})

function onLoad() {
  stopWaiting()
  loading.value = false
}

/** Отказ от текущего адреса: следующий по списку, а если он последний — заглушка. */
function giveUp() {
  if (attempt.value < candidates.value.length - 1) {
    attempt.value += 1
    return
  }

  loading.value = false
  failed.value = true
}

function onError() {
  giveUp()
}

const px = computed(() => `${props.size}px`)

const initial = computed(() => {
  const name = (props.title ?? '').trim()
  return name.charAt(0).toUpperCase() || '?'
})

// Заглушка, когда логотипа нет: первая буква названия на однотонном фоне.
// Цвет выводится из названия, чтобы один и тот же производитель выглядел
// одинаково во всех списках.
const fallbackStyle = computed(() => {
  let h = 0
  for (const ch of props.title ?? '') {
    h = (h * 31 + ch.charCodeAt(0)) >>> 0
  }
  return {
    backgroundColor: `rgb(${h & 255}, ${(h >> 8) & 255}, ${(h >> 16) & 255})`,
    fontSize: `${Math.round(props.size * 0.45)}px`,
  }
})
</script>

<style scoped>
.m-logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 6px;
  flex-shrink: 0;
  vertical-align: middle;
}

.m-logo__spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 18px;
  height: 18px;
  margin: -9px 0 0 -9px;
  border: 2px solid #444;
  border-top-color: #9fd8a6;
  border-radius: 50%;
  animation: m-logo-spin 0.7s linear infinite;
}

@keyframes m-logo-spin {
  to {
    transform: rotate(360deg);
  }
}

.m-logo__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

/* Пока грузится, картинка ещё не видна: полупрозрачная, иначе она
   мигает заглушкой, как будто логотип пропал. */
.m-logo__img--loading {
  opacity: 0;
}

.m-logo__fallback {
  color: #fff;
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
</style>
