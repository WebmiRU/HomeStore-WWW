<template>
  <div class="page" ref="pageRef">
    <div class="notify-pool">
      <Notify
        v-for="item in items"
        :key="item.id"
        :id="item.id"
        :message="item.message"
        :type="item.type"
        :timer="item.timer"
        @close="removeNotify"
      />
    </div>

    <SearchBar @search="doSearch" />

    <div v-if="searchError" class="search-error">{{ searchError }}</div>

    <div v-if="searchResult !== null && !searchError" class="search-result">
      <!-- Вариант 1: найден предмет -->
      <div v-if="searchResult.type === 'item' && searchResult.payload" class="result-card">
        <div class="result-label">Предмет</div>
        <h2 class="result-title">{{ (searchResult.payload as ItemPayload).title }}</h2>
        <div class="result-date">
          Обновлён: {{ formatDate((searchResult.payload as ItemPayload).updated_at) }}
        </div>
      </div>

      <!-- Вариант 2: найдено хранилище -->
      <div v-else-if="searchResult.type === 'store' && searchResult.payload" class="result-card">
        <div class="result-label">Хранилище</div>
        <h2 class="result-title">{{ (searchResult.payload as StorePayload).title }}</h2>
        <div class="result-date">
          Обновлён: {{ formatDate((searchResult.payload as StorePayload).updated_at) }}
        </div>
      </div>

      <!-- Вариант 3: ничего не найдено -->
      <div v-else class="result-empty">Ничего не найдено</div>
    </div>

    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { CodeSearchResponse, ItemPayload, StorePayload } from '~/repository/modules/code'

const searchResult = ref<CodeSearchResponse | null>(null)
const searchError = ref<string | null>(null)

const { $api, $notify } = useNuxtApp()
const { items, remove: removeNotify } = $notify

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

async function doSearch(uuid: string) {
  searchError.value = null
  searchResult.value = null

  try {
    searchResult.value = await $api.code.search(uuid)
  } catch (err: any) {
    searchError.value = err?.data?.error || err?.message || String(err)
  }
}

</script>

<style>
body {
  background: #1a1a1a;
  color: #ccc;
  font-family: 'Ubuntu Condensed', sans-serif;
}

@keyframes progress {
  0%   { transform: scaleX(0); }
  100% { transform: scaleX(1); }
}

.notify-pool {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 400px;
  z-index: 999;
}

.notification {
  position: relative;
  overflow: hidden;
  min-height: 52px;
  padding: 15px 48px 15px 18px;
  border: 1px solid #333;
  border-left: 4px solid #8b949e;
  border-radius: 6px;
  background-color: #1a1a2e;
  box-shadow: 0 8px 24px rgba(1, 4, 9, 0.45);
  color: #c9d1d9;
  font-size: 13px;
  line-height: 1.5;
}

.notification > span {
  display: block;
}

.notification > span + span {
  margin-top: 6px;
}

.notification--success {
  border-left-color: #3fb950;
}
.notification--success .progress {
  background-color: #3fb950;
}

.notification--error,
.notification--danger {
  border-left-color: #f85149;
}
.notification--error .progress,
.notification--danger .progress {
  background-color: #f85149;
}

.notification--warning {
  border-left-color: #d29922;
}
.notification--warning .progress {
  background-color: #d29922;
}

.notification--info {
  border-left-color: #2f81f7;
}
.notification--info .progress {
  background-color: #2f81f7;
}

.notification .delete {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #8b949e;
  cursor: pointer;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.notification .delete::before,
.notification .delete::after {
  content: '';
  position: absolute;
  top: 13px;
  left: 7px;
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background-color: currentColor;
}

.notification .delete::before {
  transform: rotate(45deg);
}

.notification .delete::after {
  transform: rotate(-45deg);
}

.notification .delete:hover {
  background-color: #21262d;
  color: #f0f6fc;
}

.notification .progress {
  height: 3px;
  width: 100%;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  transform-origin: left;
  background-color: #8b949e;
  opacity: 0.8;
  animation: progress linear;
  animation-direction: reverse;
  animation-fill-mode: forwards;
}
</style>

<style scoped>
.page {
  min-height: 100vh;
  padding: 40px;
  outline: none;
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

</style>
