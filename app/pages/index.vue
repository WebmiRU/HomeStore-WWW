<template>
  <div class="home">
    <div class="mode-buttons">
      <button
        type="button"
        class="mode-btn mode-btn--search"
        :class="{ 'mode-btn--active': activeMode === 'search' }"
        @click="activeMode = 'search'"
      >
        <svg
          class="mode-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <span class="mode-label">Поиск</span>
      </button>

      <button
        type="button"
        class="mode-btn mode-btn--add"
        :class="{ 'mode-btn--active': activeMode === 'add' }"
        @click="activeMode = 'add'"
      >
        <svg
          class="mode-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span class="mode-label">Добавить</span>
      </button>

      <button
        type="button"
        class="mode-btn mode-btn--writeoff"
        :class="{ 'mode-btn--active': activeMode === 'writeoff' }"
        @click="activeMode = 'writeoff'"
      >
        <svg
          class="mode-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 4h16v16H4z" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <polyline points="9 13 12 16 15 13" />
        </svg>
        <span class="mode-label">Списать</span>
      </button>
    </div>

    <div v-if="foundItem" class="found-item">
      <div class="found-item__header">
        <span class="found-item__title">{{ foundItem.title }}</span>
        <NuxtLink :to="`/items/${foundItem.id}/edit`" class="found-item__link">Открыть</NuxtLink>
      </div>
      <div v-if="foundItem.title_print" class="found-item__print">{{ foundItem.title_print }}</div>
      <div class="found-item__code">Код: {{ foundCode }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import type { ItemPayload } from '~/repository/modules/code'

type Mode = 'search' | 'add' | 'writeoff'

const { $api, $notify } = useNuxtApp()
const router = useRouter()

const activeMode = ref<Mode>('search')

const foundItem = ref<ItemPayload | null>(null)
const foundCode = ref('')

let buffer = ''
let lastKeyTime = 0
let scanTimer: ReturnType<typeof setTimeout> | null = null

const SCAN_KEY_RE = /^[0-9A-Za-zА-Яа-яЁё]$/
const MIN_CODE_LEN = 8
const MAX_CODE_LEN = 256
const SCAN_INTERVAL_MS = 200
const SCAN_DEBOUNCE_MS = 250

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return
  if (e.ctrlKey || e.metaKey || e.altKey) return

  const key = e.key
  if (!SCAN_KEY_RE.test(key)) return

  const now = performance.now()
  if (now - lastKeyTime > SCAN_INTERVAL_MS) {
    // Пауза между вводом — начинаем новый код
    buffer = ''
  }
  lastKeyTime = now
  buffer += key

  if (buffer.length > MAX_CODE_LEN) {
    buffer = buffer.slice(0, MAX_CODE_LEN)
  }

  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    const code = buffer
    buffer = ''
    if (code.length >= MIN_CODE_LEN && code.length <= MAX_CODE_LEN) {
      handleScan(code)
    }
  }, SCAN_DEBOUNCE_MS)
}

async function handleScan(code: string) {
  foundItem.value = null
  try {
    const result = await $api.code.search(code)

    if (result.type === 'item' && result.payload) {
      foundItem.value = result.payload as ItemPayload
      foundCode.value = code
    } else {
      // Код существует, но не связан с товаром (хранилище или ни к чему)
      router.push({ path: '/items/create', query: { code } })
    }
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.status === 404) {
      // Код не найден в базе — ведём на создание товара с этим кодом
      router.push({ path: '/items/create', query: { code } })
    } else {
      $notify.add(formatApiError(err, 'Ошибка поиска кода'), { type: 'error', timer: 10 })
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (scanTimer) clearTimeout(scanTimer)
})
</script>

<style scoped>
.home {
  padding-top: 8px;
}

.mode-buttons {
  display: flex;
  gap: 20px;
  width: 100%;
}

.mode-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 12px 20px;
  border-radius: 10px;
  border: 1px solid #333;
  background: #222;
  color: #ccc;
  cursor: pointer;
  text-decoration: none;
  font-family: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
}

.mode-btn:hover {
  transform: translateY(-2px);
  background: #2a2a2a;
}

.mode-icon {
  width: 28px;
  height: 28px;
}

.mode-label {
  font-size: 16px;
  letter-spacing: 0.5px;
}

.mode-btn--search {
  border-color: #3a4a6a;
}
.mode-btn--search .mode-icon {
  color: #4d94f7;
}
.mode-btn--search:hover {
  border-color: #4d94f7;
}

.mode-btn--add {
  border-color: #3a5a3a;
}
.mode-btn--add .mode-icon {
  color: #3fb950;
}
.mode-btn--add:hover {
  border-color: #3fb950;
}

.mode-btn--writeoff {
  border-color: #5a4a3a;
}
.mode-btn--writeoff .mode-icon {
  color: #d29922;
}
.mode-btn--writeoff:hover {
  border-color: #d29922;
}

.mode-btn--active {
  transform: translateY(-2px);
}

.mode-btn--search.mode-btn--active {
  background: #1b2b45;
  border-color: #4d94f7;
  color: #d7e6ff;
  box-shadow: 0 0 0 1px #4d94f7, 0 0 24px rgba(77, 148, 247, 0.3);
}

.mode-btn--add.mode-btn--active {
  background: #1b3525;
  border-color: #3fb950;
  color: #d8f5dc;
  box-shadow: 0 0 0 1px #3fb950, 0 0 24px rgba(63, 185, 80, 0.3);
}

.mode-btn--writeoff.mode-btn--active {
  background: #3a2e1a;
  border-color: #d29922;
  color: #f7e6c2;
  box-shadow: 0 0 0 1px #d29922, 0 0 24px rgba(210, 153, 34, 0.3);
}

.found-item {
  margin-top: 20px;
  padding: 16px 18px;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 10px;
}

.found-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.found-item__title {
  font-size: 18px;
  color: #e6e6e6;
  word-break: break-word;
}

.found-item__link {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 14px;
  color: #4d94f7;
  text-decoration: none;
  border: 1px solid #4d94f7;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.found-item__link:hover {
  background: #1b2b45;
}

.found-item__print {
  margin-top: 6px;
  font-size: 14px;
  color: #999;
}

.found-item__code {
  margin-top: 8px;
  font-size: 13px;
  color: #888;
  word-break: break-all;
}
</style>
