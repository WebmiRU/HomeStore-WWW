<template>
  <!--
    Обёртка становится кнопкой только когда включён просмотр: в шапке и в
    карточке аватар — часть интерфейса, где клик открывает другое.
  -->
  <component
    :is="lightbox ? 'button' : 'div'"
    class="avatar"
    :class="{ 'avatar--openable': lightbox }"
    :style="{ width: px, height: px }"
    :type="lightbox ? 'button' : undefined"
    :aria-label="lightbox ? `Открыть аватар: ${user.name ?? ''}` : undefined"
    @click="openViewer"
  >
    <img
      v-if="src"
      :src="src"
      :alt="user.name ?? 'Пользователь'"
      class="avatar__img"
      @error="onError"
    />
    <span v-else class="avatar__fallback" :style="fallbackStyle">{{ initial }}</span>
  </component>

  <ImageLightbox v-if="viewerOpen" :images="lightboxImages" @close="viewerOpen = false" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    user?: {
      id?: number
      name?: string | null
      avatar_url?: string | null
      avatar_sha?: string | null
    } | null
    size?: number
    thumbKey?: string
    /** Открывать ли аватар по клику в просмотре крупным кадром. */
    lightbox?: boolean
  }>(),
  { size: 56, thumbKey: '100x100_cover' }
)

const { thumbUrl } = useThumbnail()

const failed = ref(false)
const viewerOpen = ref(false)

/** Просмотр: у пользователя аватар один, стрелок в окне не будет. */
const lightboxImages = computed(() =>
  props.user?.avatar_sha || props.user?.avatar_url
    ? [{ url: props.user?.avatar_url, sha256: props.user?.avatar_sha, alt: props.user?.name ?? 'Аватар' }]
    : [],
)

function openViewer() {
  if (!props.lightbox || lightboxImages.value.length === 0) return

  viewerOpen.value = true
}

watch(
  () => props.user?.avatar_sha,
  () => {
    failed.value = false
  }
)

const src = computed(() => {
  if (!failed.value) {
    const thumb = thumbUrl(props.user?.avatar_sha, props.thumbKey)
    if (thumb) return thumb
  }
  return props.user?.avatar_url ?? ''
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