<template>
  <div class="page">
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

    <NuxtPage />

    <footer class="page-footer">
      <div class="uuid-search">
        <span class="uuid-label">Поиск по UUID:</span>
        <input
          v-model="uuidQuery"
          type="text"
          placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
          class="uuid-input"
          @keydown.enter="doUuidSearch"
        />
        <button class="uuid-btn" @click="doUuidSearch">Найти</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatApiError } from '~/composables/formatApiError'

const { $api, $notify } = useNuxtApp()
const { items, remove: removeNotify } = $notify
const router = useRouter()

const uuidQuery = ref('')

async function doSearch(q: string) {
  try {
    const results = await $api.code.fulltextSearch(q)
    if (results.length === 0) {
      $notify.add('Ничего не найдено', { type: 'info', timer: 5 })
      return
    }
    router.push({ path: '/search', query: { q } })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка поиска'), { type: 'error', timer: 10 })
  }
}

async function doUuidSearch() {
  const q = uuidQuery.value.trim()
  if (!q) return
  try {
    await $api.code.search(q)
    router.push({ path: '/search', query: { q } })
  } catch {
    $notify.add('Ничего не найдено', { type: 'info', timer: 5 })
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
  display: flex;
  flex-direction: column;
}

.page-footer {
  margin-top: auto;
  padding-top: 40px;
  display: flex;
  justify-content: center;
}

.uuid-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
}

.uuid-label {
  font-size: 13px;
  color: #777;
  white-space: nowrap;
}

.uuid-input {
  width: 300px;
  padding: 6px 10px;
  font-size: 13px;
  font-family: monospace;
  background: #2a2a2a;
  color: #bbb;
  border: 1px solid #444;
  border-radius: 4px;
  outline: none;
}

.uuid-input:focus {
  border-color: #666;
  color: #ddd;
}

.uuid-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: #333;
  color: #aaa;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.uuid-btn:hover {
  background: #444;
  color: #ddd;
}
</style>
