<template>
  <nav class="tabbar">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.key"
      :to="{ query: { ...route.query, tab: tab.key } }"
      class="tabbar__item"
      :class="{ 'tabbar__item--active': isActive(tab.key) }"
      role="tab"
      :aria-selected="isActive(tab.key)"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tabs: { key: string; label: string }[]
}>()

const route = useRoute()

const activeTab = computed(() => {
  const q = route.query.tab
  if (typeof q === 'string' && props.tabs.some((t) => t.key === q)) {
    return q
  }
  return props.tabs[0]?.key ?? ''
})

function isActive(key: string): boolean {
  return key === activeTab.value
}
</script>

<style scoped>
.tabbar {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid #333;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabbar::-webkit-scrollbar {
  display: none;
}

.tabbar__item {
  flex-shrink: 0;
  white-space: nowrap;
  padding: 10px 16px;
  font-size: 15px;
  color: #888;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.tabbar__item:hover {
  color: #bbb;
}

.tabbar__item--active {
  color: #aaf;
  border-bottom-color: #6a7fdb;
}

@media (max-width: 768px) {
  .tabbar__item {
    font-size: 16px;
    padding: 8px 12px;
  }
}
</style>