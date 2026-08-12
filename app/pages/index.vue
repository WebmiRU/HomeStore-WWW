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

    <div v-if="found" class="found-card">
      <div class="found-card__header">
        <span class="found-card__badge" :class="`found-card__badge--${found.type}`">
          {{ found.type === 'item' ? 'Предмет' : 'Хранилище' }}
        </span>
        <NuxtLink :to="editLink" class="found-card__link">Открыть</NuxtLink>
      </div>
      <div class="found-card__title">{{ found.payload.title }}</div>
      <div v-if="foundTitlePrint" class="found-card__print">
        {{ foundTitlePrint }}
      </div>
      <div v-if="foundQuantity !== null" class="found-card__quantity">
        Количество: {{ foundQuantity }}
      </div>
      <div class="found-card__code">Код: {{ found.code }}</div>
      <div class="found-card__meta">Создано: {{ formatDate(found.payload.created_at) }}</div>
    </div>

    <div v-else-if="notFoundCode" class="not-found">
      <div class="not-found__text">Код не найден в Базе.</div>
      <div class="not-found__ask">
        Добавить
        <NuxtLink :to="{ path: '/items/create', query: { code: notFoundCode } }" class="not-found__link">
          предмет
        </NuxtLink>
        или
        <NuxtLink :to="{ path: '/stores/create', query: { code: notFoundCode } }" class="not-found__link">
          хранилище
        </NuxtLink>
        ?
      </div>
      <div class="not-found__code">Код: {{ notFoundCode }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { ItemPayload, StorePayload } from '~/repository/modules/code'

type Mode = 'search' | 'add' | 'writeoff'
type FoundResult =
  | { type: 'item'; payload: ItemPayload; code: string }
  | { type: 'store'; payload: StorePayload; code: string }

const { $api, $notify } = useNuxtApp()

const activeMode = ref<Mode>('search')

const found = ref<FoundResult | null>(null)
const notFoundCode = ref('')

const editLink = computed(() => {
  if (!found.value) return ''
  return found.value.type === 'item'
    ? `/items/${found.value.payload.id}/edit`
    : `/stores/${found.value.payload.id}/edit`
})

const foundTitlePrint = computed(() =>
  found.value?.type === 'item' ? (found.value.payload as ItemPayload).title_print : '',
)

const foundQuantity = computed<string | null>(() => {
  if (found.value?.type !== 'item') return null
  const quantity = (found.value.payload as ItemPayload).quantity
  return quantity != null ? String(quantity) : '—'
})

let buffer = ''
let scanTimer: ReturnType<typeof setTimeout> | null = null

const MIN_CODE_LEN = 8
const MAX_CODE_LEN = 256
const SCAN_DEBOUNCE_MS = 300

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable
}

function onKeydown(e: KeyboardEvent) {
  if (isEditableTarget(e.target)) return
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key.length !== 1) return

  buffer += e.key
  if (buffer.length > MAX_CODE_LEN) {
    buffer = buffer.slice(0, MAX_CODE_LEN)
  }

  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    const code = buffer
    buffer = ''
    if (code.length >= MIN_CODE_LEN) {
      handleScan(code)
    }
  }, SCAN_DEBOUNCE_MS)
}

async function handleScan(code: string) {
  found.value = null
  notFoundCode.value = ''
  try {
    const result = await $api.code.search(code)

    if (result.type === 'item' && result.payload) {
      found.value = { type: 'item', payload: result.payload as ItemPayload, code }
    } else if (result.type === 'store' && result.payload) {
      found.value = { type: 'store', payload: result.payload as StorePayload, code }
    } else {
      // Код существует, но ни к чему не привязан — считаем «не найден»
      notFoundCode.value = code
    }
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.status === 404 || err?.statusCode === 400 || err?.status === 400) {
      notFoundCode.value = code
    } else {
      $notify.add(formatApiError(err, 'Ошибка поиска кода'), { type: 'error', timer: 10 })
    }
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU')
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

.found-card {
  margin-top: 20px;
  padding: 16px 18px;
  background: #1e1e1e;
  border: 1px solid #3a3a3a;
  border-radius: 10px;
}

.found-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.found-card__badge {
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid #555;
  color: #aaa;
}

.found-card__badge--item {
  color: #7db3ff;
  border-color: #4d94f7;
}

.found-card__badge--store {
  color: #8fd69a;
  border-color: #3fb950;
}

.found-card__link {
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: 14px;
  color: #4d94f7;
  text-decoration: none;
  border: 1px solid #4d94f7;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}

.found-card__link:hover {
  background: #1b2b45;
}

.found-card__title {
  margin-top: 12px;
  font-size: 18px;
  color: #e6e6e6;
  word-break: break-word;
}

.found-card__print {
  margin-top: 6px;
  font-size: 14px;
  color: #999;
}

.found-card__quantity {
  margin-top: 6px;
  font-size: 14px;
  color: #bbb;
}

.found-card__code {
  margin-top: 8px;
  font-size: 13px;
  color: #888;
  word-break: break-all;
}

.found-card__meta {
  margin-top: 6px;
  font-size: 12px;
  color: #777;
}

.not-found {
  margin-top: 20px;
  padding: 20px 18px;
  background: #2a1a1a;
  border: 1px solid #6b3a3a;
  border-radius: 10px;
}

.not-found__text {
  font-size: 20px;
  font-weight: 700;
  color: #f2b8b8;
}

.not-found__ask {
  margin-top: 10px;
  font-size: 16px;
  color: #ddd;
}

.not-found__link {
  color: #f0b45c;
  text-decoration: underline;
  margin: 0 4px;
}

.not-found__link:hover {
  color: #ffc76e;
}

.not-found__code {
  margin-top: 10px;
  font-size: 13px;
  color: #a88;
  word-break: break-all;
}
</style>
