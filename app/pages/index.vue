<template>
  <div class="home">
    <div class="mode-buttons">
      <button
        type="button"
        class="mode-btn mode-btn--search"
        :class="{ 'mode-btn--active': activeMode === 'search' }"
        @click="setMode('search')"
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
        class="mode-btn mode-btn--replenish"
        :class="{ 'mode-btn--active': activeMode === 'replenish' }"
        @click="setMode('replenish')"
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
        <span class="mode-label">Пополнить</span>
      </button>

      <button
        type="button"
        class="mode-btn mode-btn--writeoff"
        :class="{ 'mode-btn--active': activeMode === 'writeoff' }"
        @click="setMode('writeoff')"
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

    <!-- Режим «Поиск» -->
    <div v-if="activeMode === 'search' && found" class="found-card">
      <div class="found-card__header">
        <span class="found-card__badge" :class="`found-card__badge--${found.type}`">
          {{ found.type === 'item' ? 'Предмет' : 'Хранилище' }}
        </span>
        <NuxtLink :to="editLink" class="found-card__link">Открыть</NuxtLink>
      </div>

      <div class="found-card__body">
        <ItemPhotoPlaceholder />

        <div class="found-card__info">
          <div class="found-card__title">{{ found.payload.title }}</div>
          <div v-if="foundTitlePrint" class="found-card__print">
            {{ foundTitlePrint }}
          </div>
          <div class="found-card__code">Код: {{ found.code }}</div>
          <div class="found-card__meta">Создано: {{ formatDate(found.payload.created_at) }}</div>
        </div>

        <div v-if="found.type === 'item'" class="found-card__action">
          <div v-if="foundQuantity !== null" class="found-card__quantity">
            В наличии: {{ foundQuantity }}
          </div>
          <span v-else class="found-card__whole">1 шт.</span>
        </div>
      </div>
    </div>

    <div v-else-if="activeMode === 'search' && notFoundCode" class="not-found">
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

    <!-- Режимы «Пополнить» / «Списать» -->
    <div v-if="isListMode && scanList.length" class="scan-list">
      <div class="scan-list__title">{{ listTitle }}</div>
      <div v-for="entry in scanList" :key="entry.code" class="scan-row">
        <ItemPhotoPlaceholder />

        <div class="scan-row__info">
          <div class="scan-row__title">{{ entry.payload.title }}</div>
          <div v-if="entry.payload.title_print" class="scan-row__print">
            {{ entry.payload.title_print }}
          </div>
          <div class="scan-row__code">Код: {{ entry.code }}</div>
          <div v-if="entry.payload.quantity != null" class="scan-row__stock">
            В наличии: {{ entry.payload.quantity }}
          </div>
          <div class="scan-row__meta">Создано: {{ formatDate(entry.payload.created_at) }}</div>
        </div>

        <div class="scan-row__action">
          <input
            v-if="entry.payload.quantity != null"
            v-model.number="entry.count"
            type="number"
            min="1"
            step="1"
            class="scan-row__count"
          />
          <span v-else class="scan-row__whole">1 шт.</span>
        </div>

        <button
          type="button"
          class="scan-row__remove"
          :aria-label="`Удалить ${entry.payload.title}`"
          title="Удалить"
          @click="removeFromScanList(entry.code)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      <button
        type="button"
        class="scan-submit"
        :class="`scan-submit--${activeMode}`"
        @click="submitList"
      >
        {{ activeMode === 'replenish' ? 'Пополнить' : 'Списать' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import type { ItemPayload, StorePayload } from '~/repository/modules/code'

type Mode = 'search' | 'replenish' | 'writeoff'
type FoundResult =
  | { type: 'item'; payload: ItemPayload; code: string }
  | { type: 'store'; payload: StorePayload; code: string }

interface ScanEntry {
  code: string
  payload: ItemPayload
  count: number
}

const { $api, $notify } = useNuxtApp()

const activeMode = ref<Mode>('search')

const found = ref<FoundResult | null>(null)
const notFoundCode = ref('')
const scanList = ref<ScanEntry[]>([])

const isListMode = computed(
  () => activeMode.value === 'replenish' || activeMode.value === 'writeoff',
)

const listTitle = computed(() =>
  activeMode.value === 'replenish' ? 'Пополнение' : 'Списание',
)

const editLink = computed(() => {
  if (!found.value) return ''
  return found.value.type === 'item'
    ? `/items/${found.value.payload.id}/edit`
    : `/stores/${found.value.payload.id}/edit`
})

const foundTitlePrint = computed(() =>
  found.value?.type === 'item' ? (found.value.payload as ItemPayload).title_print : '',
)

const foundQuantity = computed<number | null>(() => {
  if (found.value?.type !== 'item') return null
  const quantity = (found.value.payload as ItemPayload).quantity
  return quantity ?? null
})

function setMode(mode: Mode) {
  const prev = activeMode.value
  if (prev === mode) return

  notFoundCode.value = ''

  if (prev === 'search') {
    // Поиск -> Пополнить/Списать: найденный предмет переносим в список,
    // чтобы он остался в результатах во всех режимах.
    if (found.value?.type === 'item') {
      addToScanList(found.value.code, found.value.payload)
    }
    activeMode.value = mode
    return
  }

  if (mode === 'search') {
    // Пополнить/Списать -> Поиск.
    if (scanList.value.length === 1) {
      const entry = scanList.value[0]!
      found.value = { type: 'item', payload: entry.payload, code: entry.code }
    } else if (scanList.value.length > 1) {
      // Более одного предмета — сбрасываем поиск к состоянию по умолчанию.
      found.value = null
    }
    // 0 предметов: оставляем found как есть (например, ранее найденное хранилище).
    scanList.value = []
    activeMode.value = mode
    return
  }

  // Пополнить <-> Списать: список сохраняем без изменений.
  activeMode.value = mode
}

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
  if (activeMode.value === 'search') {
    found.value = null
    notFoundCode.value = ''
  }

  try {
    const result = await $api.code.search(code)

    if (activeMode.value === 'search') {
      if (result.type === 'item' && result.payload) {
        found.value = { type: 'item', payload: result.payload as ItemPayload, code: result.code }
      } else if (result.type === 'store' && result.payload) {
        found.value = { type: 'store', payload: result.payload as StorePayload, code: result.code }
      } else {
        // Код существует, но ни к чему не привязан — считаем «не найден»
        notFoundCode.value = code
      }
    } else if (result.type === 'item' && result.payload) {
      addToScanList(result.code, result.payload as ItemPayload)
    } else {
      notifyNotFound(code)
    }
  } catch (err: any) {
    if (activeMode.value === 'search') {
      if (err?.statusCode === 404 || err?.status === 404 || err?.statusCode === 400 || err?.status === 400) {
        notFoundCode.value = code
      } else {
        $notify.add(formatApiError(err, 'Ошибка поиска кода'), { type: 'error', timer: 10 })
      }
    } else {
      notifyNotFound(code)
    }
  }
}

function addToScanList(code: string, payload: ItemPayload) {
  const existing = scanList.value.find((entry) => entry.code === code)
  if (existing) {
    // Повторное сканирование: увеличиваем количество к списанию/пополнению.
    // Для предметов без количества — всегда единственный экземпляр, ничего не делаем.
    if (payload.quantity != null) {
      existing.count += 1
    }
    return
  }
  scanList.value.push({ code, payload, count: 1 })
}

function removeFromScanList(code: string) {
  scanList.value = scanList.value.filter((entry) => entry.code !== code)
}

function notifyNotFound(code: string) {
  $notify.add(`Код "${code}" не найден`, { type: 'warning', timer: 10 })
}

function submitList() {
  // TODO: операция пополнения/списания будет реализована на бэкенде
  $notify.add(`Операция «${listTitle.value}» пока не реализована`, { type: 'info', timer: 5 })
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
