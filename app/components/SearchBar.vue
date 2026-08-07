<template>
  <div class="search-row">
    <input
      ref="searchInputRef"
      v-model="searchUuid"
      type="text"
      placeholder="Введите UUID..."
      class="search-input"
      @keydown.enter="doSearch"
    />
    <button class="search-btn" @click="doSearch">Поиск</button>

    <nav class="debug-menu">
      <span class="debug-menu-label">Предметы:</span>
      <NuxtLink to="/items" class="debug-menu-link">Список</NuxtLink>
      <NuxtLink to="/items/create" class="debug-menu-link">Добавить</NuxtLink>
    </nav>
    <nav class="debug-menu">
      <span class="debug-menu-label">Хранилища:</span>
      <NuxtLink to="/stores" class="debug-menu-link">Список</NuxtLink>
      <NuxtLink to="/stores/create" class="debug-menu-link">Добавить</NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const searchUuid = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  search: [uuid: string]
}>()

function doSearch() {
  const uuid = searchUuid.value.trim()
  if (!uuid) return
  emit('search', uuid)
}
</script>

<style scoped>
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  max-width: 400px;
  padding: 8px 12px;
  font-size: 16px;
  background: #2a2a2a;
  color: #ddd;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.search-input:focus {
  border-color: #666;
}

.search-btn {
  padding: 8px 20px;
  font-size: 16px;
  background: #333;
  color: #ddd;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
}

.search-btn:hover {
  background: #444;
}

.debug-menu {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 4px 12px;
  background: #1a1a1a;
  border: 1px dashed #444;
  border-radius: 4px;
}

.debug-menu-label {
  font-size: 13px;
  color: #666;
}

.debug-menu-link {
  font-size: 13px;
  color: #88a;
  text-decoration: none;
  padding: 2px 6px;
  border-radius: 3px;
}

.debug-menu-link:hover {
  background: #2a2a2a;
  color: #aaf;
}

.router-link-active.debug-menu-link {
  color: #aaf;
  background: #2a2a3a;
}
</style>
