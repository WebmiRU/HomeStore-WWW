<template>
  <!--
    Обёртка становится кнопкой только когда включён просмотр: в шапке и в
    карточке аватар — часть интерфейса, где клик открывает другое.
  -->
  <component
    :is="openable ? 'button' : 'div'"
    class="avatar"
    :class="{ 'avatar--openable': openable }"
    :style="{ width: px, height: px }"
    :type="openable ? 'button' : undefined"
    :aria-label="openable ? t('user_avatar.open', { name: user.name ?? '' }) : undefined"
    @click="openViewer"
  >
    <img
      v-if="src"
      :src="src"
      :srcset="srcset"
      :sizes="`${size}px`"
      :alt="user.name ?? t('user_avatar.default_name')"
      class="avatar__img"
      @error="onError"
    />
    <span v-else class="avatar__fallback" :style="fallbackStyle">{{ initial }}</span>
  </component>

  <ImageLightbox v-if="viewerOpen" :images="lightboxImages" @close="viewerOpen = false" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    user?: {
      id?: number
      name?: string | null
      avatar_url?: string | null
      avatar_sha?: string | null
      avatar_width?: number | null
      avatar_height?: number | null
    } | null
    size?: number
    /** Открывать ли аватар по клику в просмотре крупным кадром. */
    lightbox?: boolean
  }>(),
  { size: 56 }
)

const { thumbUrlFor, thumbSrcset } = useThumbnail()

/**
 * Аватар показывается и 40px в списке людей, и 120px в карточке, поэтому
 * варианты собираются по размеру, а не одной константой: один файл на оба
 * случая либо мылит, либо тащит лишнее.
 */
const avatarSource = computed<ThumbSource | null>(() =>
  props.user?.avatar_sha
    ? { sha256: props.user.avatar_sha, width: props.user.avatar_width, height: props.user.avatar_height }
    : null,
)

const srcset = computed<string>(() => thumbSrcset(avatarSource.value, props.size, 'cover'))

const failed = ref(false)
const viewerOpen = ref(false)

/** Просмотр: у пользователя аватар один, стрелок в окне не будет. */
const lightboxImages = computed(() =>
  props.user?.avatar_sha || props.user?.avatar_url
    ? [
        {
          url: props.user?.avatar_url,
          sha256: props.user?.avatar_sha,
          width: props.user?.avatar_width,
          height: props.user?.avatar_height,
          alt: props.user?.name ?? t('user_avatar.default_title'),
        },
      ]
    : [],
)

/**
 * Кнопка-просмотр — только когда есть что показывать.
 *
 * Пользователь без аватара (и пользователь, у которого картинка не
 * загрузилась) показывает букву-заглушку: лупа и кнопка там обещали бы
 * увеличение того, чего нет.
 */
const openable = computed(() => props.lightbox === true && lightboxImages.value.length > 0)

function openViewer() {
  if (!openable.value) return

  viewerOpen.value = true
}

watch(
  () => props.user?.avatar_sha,
  () => {
    failed.value = false
  }
)

const src = computed(() => {
  if (failed.value) return props.user?.avatar_url ?? ''

  return thumbUrlFor(avatarSource.value, props.size, 'cover', props.user?.avatar_url ?? null) ?? ''
})

function onError() {
  failed.value = true
}

const px = computed(() => `${props.size}px`)

const initial = computed(() => {
  const name = props.user?.name?.trim() ?? ''
  return name.charAt(0).toUpperCase() || '?'
})

const fallbackStyle = computed(() => {
  const h = ((props.user?.id ?? 1) * 2654435761) >>> 0
  const r = h & 255
  const g = (h >> 8) & 255
  const b = (h >> 16) & 255
  return { backgroundColor: `rgb(${r},${g},${b})`, fontSize: `${Math.round(props.size * 0.42)}px` }
})
</script>

<style scoped>
.avatar {
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #2a2a2a;
  border: 1px solid #444;
}

/* Кнопка-просмотр: круглая рамка и фон те же, что у обёртки, отличается
   только курсором. */
.avatar--openable {
  padding: 0;
  cursor: zoom-in;
}

.avatar--openable:hover {
  border-color: #4a7a4a;
}

.avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar__fallback {
  color: #fff;
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
</style>