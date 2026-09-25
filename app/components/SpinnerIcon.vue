<template>
  <svg
    class="spinner-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    role="status"
    aria-label="Загрузка"
  >
    <circle
      class="spinner-icon__track"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="3"
      stroke-opacity="0.25"
    />
    <path
      class="spinner-icon__arc"
      d="M22 12a10 10 0 0 0-10-10"
      stroke="currentColor"
      stroke-width="3"
      stroke-linecap="round"
    />
  </svg>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: number | string
}>(), {
  size: 24,
})
</script>

<style scoped>
.spinner-icon {
  display: inline-block;
  flex-shrink: 0;
  animation: spinner-icon-rotate 0.8s linear infinite;
}

@keyframes spinner-icon-rotate {
  to {
    transform: rotate(360deg);
  }
}
</style>