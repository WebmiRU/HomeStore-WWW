<template>
  <div v-if="src && !failed" class="item-photo-wrap">
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
  <ItemPhotoPlaceholder v-else />
</template>

<script setup lang="ts">
import type { ImageResponse } from '~/repository/modules/image'

const props = defineProps<{
  images?: ImageResponse[] | null
  alt?: string | null
}>()

const { thumbUrl } = useThumbnail()

const THUMB_KEY = '100x100_cover'

const failed = ref(false)
const loading = ref(true)

const first = computed<ImageResponse | null>(() => (props.images ?? [])[0] ?? null)

const src = computed<string | null>(() => {
  const img = first.value
  if (!img) return null
  return thumbUrl(img.sha256, THUMB_KEY) ?? img.url
})

watch(src, () => {
  loading.value = true
  failed.value = false
})

function onLoad() {
  loading.value = false
}

function onError(event: Event) {
  const el = event.target as HTMLImageElement
  const img = first.value
  // Сначала пробуем оригинал, затем — заглушку.
  if (img && el.dataset.fallback !== '1' && el.src !== img.url) {
    el.dataset.fallback = '1'
    el.src = img.url
    return
  }
  failed.value = true
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
  width: 22px;
  height: 22px;
  margin: -11px 0 0 -11px;
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
