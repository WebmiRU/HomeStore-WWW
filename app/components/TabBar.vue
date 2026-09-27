<template>
  <nav class="tabbar" :class="{ 'tabbar--wrap': wrap }">
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

const props = withDefaults(defineProps<{
  tabs: { key: string; label: string }[]
  /**
   * Переносить вкладки на следующую строку вместо горизонтальной прокрутки.
   *
   * Прокрутка полосой вверх не годится там, где вкладок много: полоса
   * скрыта, активная вкладка может оказаться за краем, и человек решает,
   * что части разделов просто нет. С переносом видно всё, и на телефоне
   * вкладки просто ложатся в несколько строк.
   */
  wrap?: boolean
}>(), { wrap: false })

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

/* Перенос: строки вместо прокрутки. Правый край у .tabbar__item при этом
   даёт лишние отступы у последней вкладки в строке, поэтому он снят. */
.tabbar--wrap {
  flex-wrap: wrap;
  overflow-x: visible;
  row-gap: 2px;
}

.tabbar--wrap .tabbar__item {
  margin-right: 0;
}

/* Подчёркивание активной вкладки в режиме переноса пришлось бы висеть
   посреди блока, а не под ним, поэтому здесь активная помечается заливкой. */
.tabbar--wrap .tabbar__item--active {
  border-bottom-color: transparent;
  background: #2a2a3a;
  border-radius: 4px;
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

  /* На телефоне тринадцать вкладок в несколько строк съедают пол-экрана,
     поэтому в переносе они мельче и короче. */
  .tabbar--wrap {
    row-gap: 0;
  }

  .tabbar--wrap .tabbar__item {
    font-size: 14px;
    padding: 6px 10px;
  }
}
</style>