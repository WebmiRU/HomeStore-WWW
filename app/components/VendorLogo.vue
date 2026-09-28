<template>
  <component
    :is="openable ? 'button' : 'span'"
    class="m-logo"
    :class="{ 'm-logo--openable': openable }"
    :style="{ width: px, height: px }"
    :type="openable ? 'button' : undefined"
    :title="openable ? t('vendor_logo.open') : title"
    :aria-label="openable ? t('vendor_logo.open_title', { title: title ?? '' }) : undefined"
    @click="openViewer"
  >
    <!-- Спиннер показывается, пока не пришла миниатюра: смена логотипа
         оставляет рамку с буквой-заглушкой на всё время запроса, и без
         индикатора не видно, идёт загрузка или она уже отвалилась. -->
    <span v-if="src && loading" class="m-logo__spinner" aria-hidden="true" />
    <img
      v-if="src"
      :src="variants.src"
      :srcset="variants.srcset"
      :sizes="variants.sizes"
      :alt="title || t('list_common.logo')"
      :class="{ 'm-logo__img--loading': loading }"
      class="m-logo__img"
      @load="onLoad"
      @error="failed = true"
    />
    <span v-else class="m-logo__fallback" :style="fallbackStyle">{{ initial }}</span>
  </component>

  <ImageLightbox v-if="viewerOpen" :images="lightboxImages" @close="viewerOpen = false" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    logoSha?: string | null
    logoUrl?: string | null
    logoWidth?: number | null
    logoHeight?: number | null
    logoThumbs?: { cover: number; contain: number } | null
    title?: string | null
    size?: number
    /**
     * Открывать ли логотип по клику в просмотре крупным кадром. Включается в
     * индексных таблицах, где логотип стоит в строке списка.
     */
    lightbox?: boolean
  }>(),
  {
    // contain, а не cover: логотип обычно широкий, и обрезка съедала бы
    // его по краям вместе с частью названия.
    size: 40,
  },
)

const { thumbVariants } = useThumbnail()

const logoSource = computed<ThumbSource | null>(() =>
  props.logoSha
    ? {
        sha256: props.logoSha,
        width: props.logoWidth,
        height: props.logoHeight,
        thumbs: props.logoThumbs ?? null,
      }
    : null,
)

/** Всегда с вписыванием: логотип обрезать нельзя, срезались бы края. */
const variants = computed(() =>
  thumbVariants(logoSource.value, props.size, 'contain', props.logoUrl ?? null),
)

/**
 * Сколько ждать миниатюру, прежде чем перестать ждать.
 *
 * Спиннер без предела — это не спиннер, а пустое место: запрос к хранилищу
 * изредка не обрывается ошибкой, а просто висит, и картинка не приходит
 * совсем. Восемь секунд на миниатюру — с большим запасом: она весит
 * несколько килобайт и приходит за доли секунды.
 */
const WAIT_MS = 8000

const failed = ref(false)
const loading = ref(false)
const viewerOpen = ref(false)

/** Просмотр: у логотипа он один, счётчика и стрелок в окне не будет. */
const lightboxImages = computed(() =>
  // Логотип без миниатюры, но с адресом тоже показываем: уменьшить его в
  // рамке списка нечем, а открыть имеет смысл.
  props.logoSha || props.logoUrl
    ? [
        {
          // Оригинал обязателен: логотип обычно меньше кадра просмотра, и
          // тогда единственный вариант, который можно показать, — он сам.
          url: props.logoUrl ?? null,
          sha256: props.logoSha,
          width: props.logoWidth,
          height: props.logoHeight,
          thumbs: props.logoThumbs ?? null,
          alt: props.title
            ? t('vendor_logo.alt_with_title', { title: props.title })
            : t('list_common.logo'),
        },
      ]
    : [],
)

/**
 * Только миниатюра, и никогда — оригинал.
 *
 * Логотип рисуют мелко: в списке это 40px, в карточке 120px. Оригинал
 * логотипа — это обычно PNG на полторы тысячи пикселей, и грузить его
 * ради рамки такого размера незачем: он весит в разы больше миниатюры, а на
 * экране всё равно ужимается браузером. Если миниатюры нет — показываем
 * первую букву названия, это честнее битой картинки.
 */
const src = computed<string | null>(() => (failed.value ? null : variants.value.src))

/**
 * Кнопка-просмотр — только когда есть что показывать.
 *
 * Производитель без логотипа показывает букву-заглушку: лупа обещала бы
 * увеличение того, чего нет. Битая картинка — тоже: после неудачи показан
 * прочерк, а не фото.
 */
const openable = computed(() => props.lightbox === true && src.value !== null)

function openViewer() {
  if (!openable.value) return

  viewerOpen.value = true
}

let timer: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/** Смена логотипа: снова показываем спиннер, пока не придёт миниатюра. */
watch(
  () => props.logoSha,
  () => {
    stopWaiting()
    failed.value = false
    loading.value = src.value !== null
  },
  { immediate: true },
)

watch(loading, (value) => {
  stopWaiting()

  if (value) {
    timer = setTimeout(() => {
      loading.value = false
      failed.value = true
    }, WAIT_MS)
  }
})

function onLoad() {
  stopWaiting()
  loading.value = false
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
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
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
  border: 2px solid var(--border-strong);
  border-top-color: var(--success-hover);
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

/* Кнопка-просмотр: рамка и фон те же, что у обёртки, отличается курсор. */
.m-logo--openable {
  padding: 0;
  cursor: zoom-in;
}

.m-logo--openable:hover {
  border-color: var(--accent-strong);
}

.m-logo__fallback {
  color: var(--accent-contrast);
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
</style>
