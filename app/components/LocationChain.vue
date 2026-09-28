<template>
  <div v-if="chain.length" class="location-chain">
    <template v-for="(crumb, i) in chain" :key="`${crumb.type}-${crumb.id}`">
      <span v-if="plain" class="crumb__plain">{{ crumb.title }}</span>
      <NuxtLink v-else :to="crumbLink(crumb)" class="crumb__link">{{ crumb.title }}</NuxtLink>
      <span v-if="i < chain.length - 1" class="crumb__sep">›</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ChainCrumb } from '~/composables/useLocationChain'

defineProps<{
  chain: ChainCrumb[]
  /**
   * Без ссылок, просто текст.
   *
   * Нужен там, где цепочка лежит внутри кнопки: ссылка внутри button —
   * невалидная вёрстка, и нажать на неё нельзя отдельно от кнопки. В окне
   * выбора предмета цепочка отвечает на вопрос «где лежит», а переходить по
   * ней оттуда незачем.
   */
  plain?: boolean
}>()

function crumbLink(crumb: ChainCrumb): string {
  if (crumb.type === 'warehouse') return `/warehouses/${crumb.id}`
  return `/stores/${crumb.id}`
}
</script>

<style scoped>
.location-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 2px;
  font-size: 12px;
  color: var(--text-dim);
}

.crumb__link {
  color: var(--info);
  text-decoration: none;
  border-bottom: 1px dashed transparent;
  transition: color 0.15s ease, border-bottom-color 0.15s ease;
  white-space: nowrap;
}

.crumb__link:hover {
  color: var(--info);
  border-bottom-color: var(--info-bg);
}

.crumb__plain {
  color: var(--text-dim);
  white-space: nowrap;
}

.crumb__sep {
  color: var(--text-dim);
  margin: 0 4px;
}
</style>