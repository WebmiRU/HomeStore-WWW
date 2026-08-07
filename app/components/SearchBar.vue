<template>
  <div class="search-row">
    <input
      ref="searchInputRef"
      v-model="searchQuery"
      type="text"
      placeholder="Поиск предметов и хранилищ..."
      class="search-input"
      @keydown.enter="doSearch"
    />
    <button class="search-btn" @click="doSearch">Поиск</button>

    <nav class="entity-nav">
      <NuxtLink to="/items" class="entity-link">Предметы</NuxtLink>
      <NuxtLink to="/stores" class="entity-link">Хранилища</NuxtLink>
      <NuxtLink to="/label-presets" class="entity-link">Шаблоны</NuxtLink>
      <NuxtLink to="/label-lists" class="entity-link">Наборы</NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  search: [query: string]
}>()

function doSearch() {
  const q = searchQuery.value.trim()
  if (!q) return
  emit('search', q)
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

.entity-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.entity-link {
  font-size: 14px;
  color: #88a;
  text-decoration: none;
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid transparent;
}

.entity-link:hover {
  background: #2a2a2a;
  color: #aaf;
  border-color: #444;
}

.router-link-active.entity-link {
  color: #aaf;
  background: #2a2a3a;
  border-color: #3a3a5a;
}
</style>
