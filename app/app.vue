<template>
  <div class="page" ref="pageRef">
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
    </div>

    <div v-if="searchError" class="search-error">{{ searchError }}</div>

    <div v-if="searchResult !== null && !searchError" class="search-result">
      <!-- Вариант 1: найден предмет -->
      <div v-if="searchResult.type === 'item' && searchResult.payload" class="result-card">
        <div class="result-label">Предмет</div>
        <h2 class="result-title">{{ (searchResult.payload as ItemPayload).title }}</h2>
        <div class="result-date">
          Обновлён: {{ formatDate((searchResult.payload as ItemPayload).updated_at) }}
        </div>

        <div v-if="searchResult.parents.length" class="breadcrumbs">
          <span class="breadcrumb-label">Цепочка хранения:</span>
          <span
            v-for="(parent, idx) in searchResult.parents"
            :key="parent.id"
            class="breadcrumb-item"
          >
            <span class="breadcrumb-sep" v-if="idx > 0">›</span>
            {{ parent.title }}
          </span>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-item breadcrumb-current">{{ (searchResult.payload as ItemPayload).title }}</span>
        </div>
      </div>

      <!-- Вариант 2: найдено хранилище -->
      <div v-else-if="searchResult.type === 'store' && searchResult.payload" class="result-card">
        <div class="result-label">Хранилище</div>
        <h2 class="result-title">{{ (searchResult.payload as StorePayload).title }}</h2>
        <div class="result-date">
          Обновлён: {{ formatDate((searchResult.payload as StorePayload).updated_at) }}
        </div>

        <div v-if="searchResult.parents.length" class="breadcrumbs">
          <span class="breadcrumb-label">Цепочка хранения:</span>
          <span
            v-for="(parent, idx) in searchResult.parents"
            :key="parent.id"
            class="breadcrumb-item"
          >
            <span class="breadcrumb-sep" v-if="idx > 0">›</span>
            {{ parent.title }}
          </span>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-item breadcrumb-current">{{ (searchResult.payload as StorePayload).title }}</span>
        </div>
      </div>

      <!-- Вариант 3: ничего не найдено -->
      <div v-else class="result-empty">Ничего не найдено</div>
    </div>

    <div class="current-input">{{ currentInput }}</div>

    <div v-if="savedLines.length" class="saved-block">
      <div v-for="(line, idx) in savedLines" :key="idx" class="saved-line">
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { CodeSearchResponse, ItemPayload, StorePayload } from '~/repository/modules/code'

const currentInput = ref('')
const savedLines = ref<string[]>([])
const pageRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const searchUuid = ref('')
const searchResult = ref<CodeSearchResponse | null>(null)
const searchError = ref<string | null>(null)

const { $api } = useNuxtApp()

function formatDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function handleKeydown(e: KeyboardEvent) {
  // Не перехватываем клавиши, если фокус в поле поиска
  if (document.activeElement === searchInputRef.value) return

  if (e.key === 'Enter') {
    if (currentInput.value.trim()) {
      savedLines.value.push(currentInput.value)
      currentInput.value = ''
    }
    return
  }

  if (e.key === 'Backspace') {
    currentInput.value = currentInput.value.slice(0, -1)
    return
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    currentInput.value += e.key
  }
}

async function doSearch() {
  const uuid = searchUuid.value.trim()
  if (!uuid) return

  searchError.value = null
  searchResult.value = null

  try {
    searchResult.value = await $api.code.search(uuid)
  } catch (err: any) {
    searchError.value = err?.data?.error || err?.message || String(err)
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  nextTick(() => {
    pageRef.value?.focus()
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style>
body {
  background: #1a1a1a;
  color: #ccc;
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px;
  outline: none;
}

.search-row {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
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

.search-error {
  margin-bottom: 24px;
  padding: 12px 16px;
  background: #3a1a1a;
  border: 1px solid #622;
  border-radius: 4px;
  color: #f88;
  font-size: 14px;
}

.search-result {
  margin-bottom: 24px;
}

.result-card {
  padding: 20px;
  background: #222;
  border: 1px solid #333;
  border-radius: 6px;
}

.result-label {
  font-size: 12px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 6px;
  letter-spacing: 1px;
}

.result-title {
  margin: 0 0 8px;
  font-size: 22px;
  color: #eee;
}

.result-date {
  font-size: 13px;
  color: #999;
  margin-bottom: 16px;
}

.breadcrumbs {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid #333;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.breadcrumb-label {
  font-size: 12px;
  color: #777;
  margin-right: 8px;
}

.breadcrumb-item {
  font-size: 14px;
  color: #aaa;
}

.breadcrumb-sep {
  color: #555;
  margin: 0 4px;
  font-size: 16px;
}

.breadcrumb-current {
  color: #4af;
  font-weight: 600;
}

.result-empty {
  padding: 20px;
  background: #222;
  border: 1px solid #333;
  border-radius: 6px;
  color: #888;
  text-align: center;
  font-size: 15px;
}

.current-input {
  font-size: 24px;
  min-height: 40px;
}

.saved-block {
  margin-top: 40px;
}

.saved-line {
  font-size: 16px;
  padding: 4px 0;
}
</style>
