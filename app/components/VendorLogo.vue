<template>
  <span class="m-logo" :style="{ width: px, height: px }" :title="title">
    <img v-if="src" :src="src" :alt="title || 'Логотип'" class="m-logo__img" @error="onError" />
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

const failed = ref(false)

// Смена логотипа должна перерисовывать картинку: без сброса флага
// браузер показал бы старую миниатюру до перезагрузки страницы.
watch(
  () => props.logoSha,
  () => {
    failed.value = false
  },
)

const src = computed(() => {
  if (!failed.value) {
    const thumb = thumbUrl(props.logoSha, props.thumbKey)
    if (thumb) return thumb
  }
  return props.logoUrl ?? ''
})

function onError() {
  failed.value = true
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
  for (const ch of (props.title ?? '')) {
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

.m-logo__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.m-logo__fallback {
  color: #fff;
  font-weight: 600;
  user-select: none;
  line-height: 1;
}
</style>
