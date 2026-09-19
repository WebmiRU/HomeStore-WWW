<template>
  <div class="home">
    <div class="mode-buttons">
      <button
        type="button"
        class="mode-btn mode-btn--search"
        :class="{ 'mode-btn--active': hydrated && activeMode === 'search' }"
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
        :class="{ 'mode-btn--active': hydrated && activeMode === 'replenish' }"
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
        :class="{ 'mode-btn--active': hydrated && activeMode === 'writeoff' }"
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
        <ItemPhoto :images="found.payload.images" :alt="foundTitlePrint || found.payload.title" />

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

      <div v-if="foundChain.length" class="found-card__chain">
        <LocationChain :chain="foundChain" />
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
      <div
        v-for="entry in scanList"
        :key="entry.code"
        class="scan-row"
        :class="[
          entry.done ? ['scan-row--done', `scan-row--done--${entry.doneMode}`] : '',
          !entry.done && entryProblem(entry) !== null ? 'scan-row--invalid' : '',
        ]"
      >
        <ItemPhoto :images="entry.payload.images" :alt="entry.payload.title_print || entry.payload.title" />

        <div class="scan-row__info">
          <div class="scan-row__title">{{ entry.payload.title }}</div>
          <div v-if="entry.payload.title_print" class="scan-row__print">
            {{ entry.payload.title_print }}
          </div>
          <div class="scan-row__code">Код: {{ entry.code }}</div>
          <div v-if="!entry.done && entry.payload.quantity != null" class="scan-row__stock">
            В наличии: {{ entry.payload.quantity }}
          </div>
          <div v-else-if="entry.done" class="scan-row__stock">
            <span
              class="scan-row__done"
              :class="`scan-row__done--${entry.doneMode}`"
              :title="`Выполнено: ${formatDate(entry.doneAt)}`"
            >
              {{ entry.doneMode === 'replenish' ? 'Пополнено' : 'Списано' }}
            </span>
            <span class="scan-row__residue">
              Остаток: {{ entry.payload.quantity }}
              ({{ entry.doneMode === 'replenish' ? '+' : '−' }}{{ entry.doneDelta }})
            </span>
          </div>
          <div v-if="!entry.done && entry.payload.quantity == null" class="scan-row__hint">
            Единичный предмет — операция на 1 шт.
          </div>
          <div v-if="!entry.done && entryProblem(entry) !== null" class="scan-row__hint scan-row__hint--error">
            {{ entryProblem(entry) }}
          </div>
          <div class="scan-row__meta">Создано: {{ formatDate(entry.payload.created_at) }}</div>
          <div v-if="scanChains[entry.code]?.length" class="scan-row__chain">
            <LocationChain :chain="scanChains[entry.code]" />
          </div>
        </div>

        <div class="scan-row__action">
          <template v-if="!entry.done">
            <input
              v-if="entry.payload.quantity != null"
              v-model.number="entry.count"
              type="number"
              min="1"
              step="1"
              class="scan-row__count"
            />
            <span v-else class="scan-row__whole">1 шт.</span>
          </template>
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

      <div class="scan-controls">
        <button
          type="button"
          class="scan-submit"
          :class="`scan-submit--${activeMode}`"
          :disabled="submitting || pendingEntries === 0"
          @click="submitList"
        >
          {{ submitting ? 'Сохранение…' : activeMode === 'replenish' ? 'Пополнить' : 'Списать' }}
          <template v-if="!submitting && pendingEntries"> ({{ pendingEntries }})</template>
        </button>

        <button
          v-if="scanList.length"
          type="button"
          class="scan-reset"
          :disabled="submitting"
          title="Очистить список"
          @click="clearList"
        >
          Сбросить
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ItemPayload, StorePayload } from '~/repository/modules/code'
import type { OperationRow, OperationType } from '~/repository/modules/operation'
import type { OperationMode } from '~/composables/useOperationMode'
import type { ChainCrumb } from '~/composables/useLocationChain'

type Mode = OperationMode
type FoundResult =
  | { type: 'item'; payload: ItemPayload; code: string }
  | { type: 'store'; payload: StorePayload; code: string }

interface ScanEntry {
  code: string
  payload: ItemPayload
  count: number
  done: boolean
  doneAt: string
  doneDelta: number
  doneMode: Mode | null
}

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const { mode: savedMode, persist } = useOperationMode()
const { chainForStore } = useLocationChain()

// Акцент активной кнопки включаем только на клиенте после гидрации:
// SSR и первичный client-render отрисовывают кнопки без «активной» рамки
// (совпадают друг с другом — без hydration mismatch), а сразу после
// монтирования подсвечивается сохранённый из сессии режим.
const hydrated = ref(false)

onMounted(() => {
  hydrated.value = true
})

// Режим берём сразу из сессии: модуль useOperationMode на клиенте читает
// sessionStorage при импорте, поэтому savedMode.value корректен уже в setup.
const activeMode = ref<Mode>(savedMode.value)

const found = ref<FoundResult | null>(null)
const notFoundCode = ref('')
const scanList = ref<ScanEntry[]>([])
const foundChain = ref<ChainCrumb[]>([])
const scanChains = ref<Record<string, ChainCrumb[]>>({})
const submitting = ref(false)

const pendingEntries = computed(() => scanList.value.filter((entry) => !entry.done).length)

// Причина, по которой строку нельзя отправить в операции (или null — можно).
function entryProblem(entry: ScanEntry): string | null {
  if (entry.done) return null
  if (!Number.isInteger(entry.count) || entry.count < 1) {
    return 'Количество должно быть целым и не меньше 1'
  }
  if (activeMode.value === 'writeoff' && entry.payload.quantity != null && entry.count > entry.payload.quantity) {
    return `В наличии ${entry.payload.quantity}, указано ${entry.count}`
  }
  return null
}

const invalidRows = computed(() => scanList.value.filter((entry) => entryProblem(entry) !== null))

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

  // Запоминаем выбранный режим в сессии: при следующем сканировании
  // (с любой страницы) автоматически включится он же.
  persist(mode)

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
    // Определяем код, который нужно обновить повторным запросом:
    // единственный предмет в списке, либо найденный предмет при пустом списке
    // (после успешной операции список очищается, а found остаётся со старым количеством).
    const refreshCode =
      scanList.value.length === 1
        ? scanList.value[0]!.code
        : scanList.value.length === 0 && found.value?.type === 'item'
          ? found.value.code
          : null

    if (scanList.value.length === 1) {
      const entry = scanList.value[0]!
      found.value = { type: 'item', payload: entry.payload, code: entry.code }
      void refreshFoundChain()
    } else if (scanList.value.length > 1) {
      // Более одного предмета — сбрасываем поиск к состоянию по умолчанию.
      found.value = null
      foundChain.value = []
    }
    // 0 предметов: оставляем found как есть (например, ранее найденное хранилище).

    scanList.value = []
    activeMode.value = mode

    if (refreshCode) {
      // Повторный запрос, чтобы обновить количество после списания/пополнения.
      void refreshFoundItem(refreshCode)
    }
    return
  }

  // Пополнить <-> Списать: начинаем заново, чтобы не смешивать смысл
  // и цветовые статусы выполненных записей.
  scanList.value = []
  scanChains.value = {}
  activeMode.value = mode
}

async function refreshFoundItem(code: string) {
  try {
    const result = await $api.code.search(code)
    if (activeMode.value !== 'search') return
    if (result.type === 'item' && result.payload) {
      found.value = { type: 'item', payload: result.payload as ItemPayload, code: result.code }
      void refreshFoundChain()
    } else if (result.type === 'store' && result.payload) {
      found.value = { type: 'store', payload: result.payload as StorePayload, code: result.code }
      void refreshFoundChain()
    }
  } catch {
    // Фоновое обновление: ошибки игнорируем, оставляем текущий результат.
  }
}

async function refreshFoundChain() {
  const f = found.value
  if (!f) {
    foundChain.value = []
    return
  }
  foundChain.value =
    f.type === 'item'
      ? await chainForStore(f.payload.store_id)
      : await chainForStore(f.payload.id, false)
}

async function handleScan(code: string) {
  if (activeMode.value === 'search') {
    found.value = null
    foundChain.value = []
    notFoundCode.value = ''
  }

  try {
    const result = await $api.code.search(code)

    if (activeMode.value === 'search') {
      if (result.type === 'item' && result.payload) {
        found.value = { type: 'item', payload: result.payload as ItemPayload, code: result.code }
        void refreshFoundChain()
      } else if (result.type === 'store' && result.payload) {
        found.value = { type: 'store', payload: result.payload as StorePayload, code: result.code }
        void refreshFoundChain()
      } else {
        // Код существует, но ни к чему не привязан — считаем «не найден»
        found.value = null
        foundChain.value = []
        notFoundCode.value = code
      }
    } else if (result.type === 'item' && result.payload) {
      clearDoneEntries()
      addToScanList(result.code, result.payload as ItemPayload)
    } else if (result.type === 'store' && result.payload) {
      notifyStoreBlocked(result.payload as StorePayload)
    } else {
      handleCodeNotFound(code)
    }
  } catch (err: any) {
    if (activeMode.value === 'search') {
      if (err?.statusCode === 404 || err?.status === 404 || err?.statusCode === 400 || err?.status === 400) {
        notFoundCode.value = code
      } else {
        $notify.add(formatApiError(err, 'Ошибка поиска кода'), { type: 'error', timer: 10 })
      }
    } else {
      handleCodeNotFound(code)
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
  scanList.value.push({ code, payload, count: 1, done: false, doneAt: '', doneDelta: 0, doneMode: null })
  void setScanChain(code, payload)
}

// Повторное сканирование: выполненные записи убираем, невыполненные сохраняем.
function clearDoneEntries() {
  const done = scanList.value.filter((entry) => entry.done)
  if (done.length === 0) return
  const codes = new Set(done.map((entry) => entry.code))
  scanList.value = scanList.value.filter((entry) => !entry.done)
  codes.forEach((code) => {
    delete scanChains.value[code]
  })
}

function clearList() {
  scanList.value = []
  scanChains.value = {}
}

async function setScanChain(code: string, payload: ItemPayload) {
  scanChains.value[code] = await chainForStore(payload.store_id)
}

function removeFromScanList(code: string) {
  scanList.value = scanList.value.filter((entry) => entry.code !== code)
  delete scanChains.value[code]
}

// Код не найден: переключаемся в «Поиск» и показываем предложение
// добавить предмет или хранилище.
function handleCodeNotFound(code: string) {
  activeMode.value = 'search'
  found.value = null
  foundChain.value = []
  scanList.value = []
  scanChains.value = {}
  notFoundCode.value = code
}

function notifyStoreBlocked(store: StorePayload) {
  const action = activeMode.value === 'replenish' ? 'пополнить' : 'списать'
  $notify.add(`Хранилище "${store.title}" нельзя ${action}`, { type: 'warning', timer: 10 })
}

async function submitList() {
  if (submitting.value) return

  const pending = scanList.value.filter((entry) => !entry.done)
  const rows: OperationRow[] = pending.map((entry) => ({
    code: entry.code,
    quantity: entry.payload.quantity != null ? entry.count : 1,
  }))

  if (rows.length === 0) {
    $notify.add('Нет предметов для операции', { type: 'warning', timer: 5 })
    return
  }

  const problems = pending
    .map((entry) => ({ entry, problem: entryProblem(entry) }))
    .filter((item): item is { entry: ScanEntry; problem: string } => item.problem !== null)

  if (problems.length > 0) {
    const details = problems
      .map((item) => `«${item.entry.payload.title}»: ${item.problem}`)
      .join('; ')
    $notify.add(`Невозможно выполнить операцию: ${details}`, { type: 'error', timer: 12 })
    return
  }

  const modeAtSubmit = activeMode.value
  const type: OperationType =
    modeAtSubmit === 'replenish' ? 'operation.replenish' : 'operation.writeoff'
  const isReplenish = type === 'operation.replenish'

  submitting.value = true
  try {
    const result = await $api.operation.store({ type, payload: rows })
    const rowsByCode = new Map((result?.rows ?? []).map((row) => [row.code, row]))
    const now = new Date().toISOString()

    for (const entry of pending) {
      const applied = rowsByCode.get(entry.code)
      if (applied) {
        entry.payload.quantity = applied.after
        entry.doneDelta = applied.delta
      } else {
        // Сервер не вернул строки (например, старый api) — считаем остаток локально.
        const base = entry.payload.quantity != null ? entry.payload.quantity : 1
        entry.payload.quantity = isReplenish
          ? base + entry.count
          : base - entry.count
        entry.doneDelta = entry.count
      }
      entry.done = true
      entry.doneAt = now
      entry.doneMode = modeAtSubmit
    }

    const deltaSum = rows.reduce((sum, row) => sum + row.quantity, 0)
    const sign = isReplenish ? '+' : '&minus;'
    const verb = isReplenish ? 'Пополнено' : 'Списано'
    $notify.add(`${verb}: ${rows.length} ${pluralItems(rows.length)} (${sign}${deltaSum} шт.)`, {
      type: 'success',
      timer: 6,
    })
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка операции'), { type: 'error', timer: 10 })
  } finally {
    submitting.value = false
  }
}

function pluralItems(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'предмет'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'предмета'
  return 'предметов'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ru-RU')
}

// Поле «КОД» в футере эмулирует сканер, а глобальный сканер (app.vue)
// обрабатывает код с устройства на любой странице: всё сводится к переходу
// на главную с ?scan=<code>. Здесь код обрабатываем так же, как если бы он
// пришёл с устройства ввода.
// `?mode=replenish|writeoff` (из результатов поиска) сразу включает нужный
// режим — предмет попадает в список, как при сканировании.
// Без `?mode` включается последний сохранённый в сессии режим.
watch(
  () => route.query.scan,
  (value) => {
    if (!import.meta.client) return
    if (typeof value !== 'string' || !value) return

    const rest = { ...route.query }
    delete rest.scan

    const modeParam = route.query.mode
    if (modeParam === 'replenish' || modeParam === 'writeoff') {
      setMode(modeParam)
      delete rest.mode
    } else {
      // Сканирование без явного режима — работаем в сохранённом из сессии.
      setMode(savedMode.value)
    }

    void router.replace({ query: rest })
    void handleScan(value)
  },
  { immediate: true },
)
</script>
