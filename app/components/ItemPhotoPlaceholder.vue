<template>
  <svg
    class="item-photo-placeholder"
    :style="frameStyle"
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
      :stroke-width="frameStroke"
      stroke-dasharray="4 4"
    />
    <!-- фотоаппарат -->
    <g
      fill="none"
      stroke="currentColor"
      :stroke-width="glyphStroke"
      stroke-linecap="round"
      stroke-linejoin="round"
      transform="translate(18 14) scale(2)"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </g>
    <!--
      Подпись. В маленьком размере её не рисуем: в ячейке таблицы это десять
      пикселей, а уменьшенные вчетверо превращаются в неразборчивую рябь, и
      заглушка начинает выглядеть сломанной картинкой, а не отсутствующей.
    -->
    <text
      v-if="showCaption"
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

const props = defineProps<{
  /** Явный размер в CSS-пикселях. Без него — из стилей, как у ItemPhoto. */
  size?: number | null
}>()

const frameStyle = computed(() =>
  props.size == null ? undefined : { width: `${props.size}px`, height: `${props.size}px` },
)

// Подпись помещается там, где её ещё можно прочесть.
const showCaption = computed(() => props.size == null || props.size >= 56)

// Рисунок задан в виде 84×84 и уменьшается целиком, поэтому толщина линий
// уменьшается вместе с ним. На сорока пикселях от штриха в полпикселя не
// остаётся ничего — утолщаем обратно, иначе заглушка выглядит пустой рамкой.
const lineBoost = computed(() => (props.size == null || props.size >= 56 ? 1 : 1.8))
const frameStroke = computed(() => 1 * lineBoost.value)
const glyphStroke = computed(() => 1.5 * lineBoost.value)
</script>

<style scoped>
.item-photo-placeholder {
  display: block;
  width: 84px;
  height: 84px;
  flex-shrink: 0;
  color: #777;
}

@media (max-width: 768px) {
  .item-photo-placeholder {
    width: 56px;
    height: 56px;
  }
}
</style>
