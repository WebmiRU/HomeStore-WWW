<template>
  <Teleport to="body">
    <div class="lightbox" @click.self="emit('close')">
      <button type="button" class="lightbox__close" :aria-label="t('images.close')" @click="emit('close')">×</button>

      <button
        v-if="multiple"
        type="button"
        class="lightbox__nav lightbox__nav--prev"
        :aria-label="t('images.previous')"
        @click="step(-1)"
      >‹</button>

      <div class="lightbox__stage">
        <span v-if="loading" class="lightbox__spinner" aria-hidden="true" />
        <img
          v-if="src"
          :src="src"
          :srcset="srcset"
          :sizes="sizes"
          :alt="current?.alt ?? ''"
          :class="{ 'lightbox__img--loading': loading }"
          class="lightbox__img"
          @load="onLoad"
          @error="onError"
        />
        <p v-else class="lightbox__error">{{ emptyMessage }}</p>
      </div>

      <button
        v-if="multiple"
        type="button"
        class="lightbox__nav lightbox__nav--next"
        :aria-label="t('images.next')"
        @click="step(1)"
      >›</button>

      <p v-if="caption" class="lightbox__caption">{{ caption }}</p>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/** Всё, что нужно для показа: миниатюра строится по sha256, alt — подпись. */
type LightboxImage = {
  url?: string | null
  sha256?: string | null
  alt?: string | null
  /** Размеры оригинала: по ним варианты режутся, чтобы не предлагать лишнее. */
  width?: number | null
  height?: number | null
  /** Пределы миниатюр, посчитанные сервером: см. ImageResponse.thumbs. */
  thumbs?: { cover: number; contain: number } | null
}

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    images: LightboxImage[]
    // С какой картинки открывать.
    index?: number
  }>(),
  {
    index: 0,
  },
)

const emit = defineEmits<{ close: [] }>()

const { thumbVariants } = useThumbnail()

/**
 * Предел кадра в css-пикселях: ровно тот, что задан в стилях (min(800px,
 * calc(100vw - 60px))). Варианты в srcset строятся под него, а sizes отдаёт
 * браузеру ту же формулу: на узком окне он возьмёт вариант поменьше, и
 * считать это вручную на каждый resize незачем.
 */
const MAX_DISPLAY = 800

/**
 * Сколько ждать превью, прежде чем признать его неудачным.
 *
 * Отдельный и больший срок, чем у картинок в таблице: первую выдачу этой
 * миниатюры сервер делает на лету (сжимает оригинал и кладёт в хранилище), и
 * на большой фотографии это занимает заметно дольше, чем доставание готового
 * файла. Восемь секунд у табличных картинок такую превью обрезали бы на
 * ровном месте.
 */
const WAIT_MS = 20000

const index = ref(props.index)
const failed = ref(false)
const loading = ref(false)

const multiple = computed(() => props.images.length > 1)

const current = computed<LightboxImage | null>(() => props.images[index.value] ?? null)

/**
 * Варианты, размер и обещание ширины — одним куском.
 *
 * Снимок 473×162 не станет полноэкранным: в sizes обещание ограничено тем,
 * что реально есть, иначе браузер растянет оригинал до 800 и получится мыло.
 * Логотип 736×736 — тем более: под него в лестнице нет ни одной ступени, и
 * единственный вариант для него — сам оригинал.
 */
const variants = computed(() =>
  thumbVariants(current.value, MAX_DISPLAY, 'contain', current.value?.url ?? null, 'min(800px, calc(100vw - 60px))'),
)

/**
 * Что пробуем по порядку: сперва то, что выбрал thumbVariants, потом —
 * оригинал целиком.
 *
 * Второй адрес на случай, если первая картинка не получилась: в модалке это
 * дорого, но картинка лучше, чем заглушка. Список берётся из того же
 * расчёта, что и srcset, — иначе.src мог оказаться пустым при непустом
 * srcset, и окно показывало бы «не удалось загрузить» вместо картинки,
 * которой оно даже не пыталось запросить.
 */
const candidates = computed<string[]>(() => {
  const image = current.value
  if (image === null) return []

  return [...new Set([variants.value.src ?? '', image.url ?? ''])].filter((url) => url !== '')
})

const srcset = computed<string>(() => variants.value.srcset)
const sizes = computed<string>(() => variants.value.sizes)

/**
 * Две разные беды — две разные надписи.
 *
 * «Показать нечего» (нет ни миниатюры, ни оригинала) и «не пришло» (адрес
 * был, файл не ответил) — разные случаи, и раньше оба выглядели как сбой
 * загрузки, хотя во втором случае запроса не было вовсе.
 */
const emptyMessage = computed(() =>
  candidates.value.length === 0 ? t('images.nothing_to_show') : t('images.load_failed'),
)

const attempt = ref(0)
const src = computed<string | null>(() => (failed.value ? null : (candidates.value[attempt.value] ?? null)))

let timer: ReturnType<typeof setTimeout> | null = null

function stopWaiting() {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/**
 * Смена картинки: попытки с начала и снова спиннер.
 *
 * Сторож ставится на src, а не на current: переход с миниатюры на оригинал
 * после неудачи — это тоже ожидание, и молчаливый оригинал показался бы
 * картинкой, которая «просто не успела».
 */
watch(current, () => {
  attempt.value = 0
  failed.value = false
  startWaiting()
}, { immediate: true })

watch(src, () => {
  failed.value = false
  startWaiting()
})

function startWaiting() {
  stopWaiting()

  loading.value = src.value !== null

  if (loading.value) {
    timer = setTimeout(giveUp, WAIT_MS)
  }
}

function giveUp() {
  if (attempt.value < candidates.value.length - 1) {
    attempt.value += 1
    return
  }

  stopWaiting()
  loading.value = false
  failed.value = true
}

function onLoad() {
  stopWaiting()
  loading.value = false
}

function onError() {
  giveUp()
}

function step(delta: number) {
  const count = props.images.length

  if (count === 0) return

  index.value = (index.value + delta + count) % count
}

const caption = computed(() => {
  const alt = current.value?.alt?.trim()

  return multiple.value
    ? `${index.value + 1} / ${props.images.length}${alt ? ` — ${alt}` : ''}`
    : (alt ?? '')
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }

  if (!multiple.value) return

  if (event.key === 'ArrowLeft') step(-1)
  if (event.key === 'ArrowRight') step(1)
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // Прокрутка страницы под модалкой не нужна: колесо уходило бы вниз по
  // списку, из которого окно и открыто.
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  stopWaiting()
})
</script>

<style scoped>
/*
  Подложка: поля по 30px с каждой стороны. Те же 30px вычтены из предела
  самой картинки, поэтому кадр не подходит ни к одному краю.
*/
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
  background: rgba(0, 0, 0, 0.82);
}

.lightbox__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  max-height: 100%;
}

.lightbox__img {
  display: block;
  /*
    Предел задан прямо на картинке, в единицах окна, а не в процентах от
    родителя: процентная max-height не разрешается, если высота родителя не
    определена, и на высоком снимке кадр тогда вышел бы за край экрана.
    calc вычитает те же 30px полей, что и padding у подложки: на окне
    800x600 кадр будет 740x540, на большом мониторе — не шире 800.
  */
  max-width: min(800px, calc(100vw - 60px));
  max-height: min(800px, calc(100vh - 60px));
  object-fit: contain;
  background: #111;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
}

.lightbox__img--loading {
  opacity: 0;
}

.lightbox__spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border: 3px solid #444;
  border-top-color: #9fd8a6;
  border-radius: 50%;
  animation: lightbox-spin 0.7s linear infinite;
}

@keyframes lightbox-spin {
  to {
    transform: rotate(360deg);
  }
}

.lightbox__error {
  margin: 0;
  font-size: 14px;
  color: #888;
}

.lightbox__close,
.lightbox__nav {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-family: inherit;
  line-height: 1;
  color: #ddd;
  background: rgba(30, 30, 30, 0.8);
  border: 1px solid #444;
  border-radius: 8px;
  cursor: pointer;
}

.lightbox__close {
  top: 12px;
  right: 12px;
  width: 38px;
  height: 38px;
  font-size: 24px;
}

.lightbox__nav {
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 60px;
  font-size: 34px;
}

.lightbox__nav--prev {
  left: 10px;
}

.lightbox__nav--next {
  right: 10px;
}

.lightbox__close:hover,
.lightbox__nav:hover {
  color: #fff;
  background: #2a2a2a;
}

.lightbox__caption {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  max-width: calc(100% - 200px);
  margin: 0;
  padding: 4px 10px;
  font-size: 13px;
  color: #ccc;
  text-align: center;
  background: rgba(20, 20, 20, 0.75);
  border-radius: 6px;
  /* Подпись не должна перехватывать клик по затемнению — им закрывается окно. */
  pointer-events: none;
}

@media (max-width: 768px) {
  /* Поля остаются теми же 30px: кадр не должен упираться в край экрана
     ни на телефоне, ни на десктопе. */
  .lightbox__caption {
    max-width: calc(100% - 24px);
  }
}
</style>
