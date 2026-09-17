<template>
  <img
    v-if="src && !failed"
    class="item-photo"
    :src="src"
    :alt="alt ?? ''"
    loading="lazy"
    @error="onError"
  />
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

const first = computed<ImageResponse | null>(() => (props.images ?? [])[0] ?? null)

const src = computed<string | null>(() => {
  const img = first.value
  if (!img) return null
  return thumbUrl(img.sha256, THUMB_KEY) ?? img.url
})

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
.item-photo {
  display: block;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  object-fit: cover;
  border: 1px solid #333;
  border-radius: 8px;
  background: #222;
}

@media (max-width: 768px) {
  .item-photo {
    width: 56px;
    height: 56px;
  }
}
</style>
