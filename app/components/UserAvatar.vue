<template>
  <div class="avatar" :style="{ width: px, height: px }">
    <img
      v-if="user?.avatar_url"
      :src="user.avatar_url"
      :alt="user.name ?? 'Пользователь'"
      class="avatar__img"
    />
    <span v-else class="avatar__fallback" :style="fallbackStyle">{{ initial }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    user?: { id?: number; name?: string | null; avatar_url?: string | null } | null
    size?: number
  }>(),
  { size: 56 }
)

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