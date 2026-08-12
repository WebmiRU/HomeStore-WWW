<template>
  <svg
    class="item-photo-placeholder"
    viewBox="0 0 84 84"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="Нет фото"
  >
    <!-- рамка-заглушка -->
    <rect
      x="1"
      y="1"
      width="82"
      height="82"
      rx="8"
      fill="none"
      stroke="currentColor"
      stroke-width="1"
      stroke-dasharray="4 4"
    />
    <!-- фотоаппарат -->
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      transform="translate(18 14) scale(2)"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </g>
    <!-- подпись -->
    <text
      x="42"
      y="75"
      text-anchor="middle"
      font-size="10"
      fill="currentColor"
      stroke="none"
    >
      Нет фото
    </text>
  </svg>
</template>

<script setup lang="ts">
// Заглушка фотографии предмета. Позже будет заменена на реальное изображение.
</script>

<style scoped>
.item-photo-placeholder {
  display: block;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  color: #777;
}
</style>
