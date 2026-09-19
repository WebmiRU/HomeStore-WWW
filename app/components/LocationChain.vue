<template>
  <div v-if="chain.length" class="location-chain">
    <NuxtLink
      v-for="(crumb, i) in chain"
      :key="`${crumb.type}-${crumb.id}`"
      :to="crumbLink(crumb)"
      class="crumb__link"
    >{{ crumb.title }}</NuxtLink
    ><span v-if="i < chain.length - 1" class="crumb__sep">›</span>
  </div>
</template>

<script setup lang="ts">
import type { ChainCrumb } from '~/composables/useLocationChain'

defineProps<{
  chain: ChainCrumb[]
}>()

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
  gap: 4px 2px;
  font-size: 12px;
  color: #777;
}

.crumb__link {
  color: #88a;
  text-decoration: none;
  border-bottom: 1px dashed transparent;
  transition: color 0.15s ease, border-bottom-color 0.15s ease;
  white-space: nowrap;
}

.crumb__link:hover {
  color: #aaf;
  border-bottom-color: #3a3a5a;
}

.crumb__sep {
  color: #555;
  margin: 0 4px;
}
</style>