<template>
  <div v-if="chain.length" class="location-chain">
    <span v-for="(crumb, i) in chain" :key="`${crumb.type}-${crumb.id}`" class="crumb">
      <span class="crumb__kind">{{ kindLabel(crumb) }}</span>
      <NuxtLink :to="crumbLink(crumb)" class="crumb__link">{{ crumb.title }}</NuxtLink>
      <span v-if="i < chain.length - 1" class="crumb__sep">›</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { ChainCrumb } from '~/composables/useLocationChain'

defineProps<{
  chain: ChainCrumb[]
}>()

function kindLabel(crumb: ChainCrumb): string {
  if (crumb.type === 'warehouse') return 'Склад'
  if (crumb.type === 'store') return crumb.root ? 'Хранилище' : 'Подхранилище'
  return 'Предмет'
}

function crumbLink(crumb: ChainCrumb): string {
  if (crumb.type === 'item') return `/items/${crumb.id}/edit`
  if (crumb.type === 'warehouse') return `/warehouses/${crumb.id}/edit`
  return `/stores/${crumb.id}/edit`
}
</script>

<style scoped>
.location-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  font-size: 12px;
  color: #777;
}

.crumb {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
}

.crumb__kind {
  font-size: 11px;
  color: #666;
  text-transform: lowercase;
}

.crumb__link {
  color: #88a;
  text-decoration: none;
  border-bottom: 1px dashed transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.crumb__link:hover {
  color: #aaf;
  border-bottom-color: #3a3a5a;
}

.crumb__sep {
  color: #555;
  margin-left: 2px;
}
</style>