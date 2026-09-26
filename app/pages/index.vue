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

    <!-- Несколько предметов с одним кодом: показываем все варианты -->
    <div v-else-if="activeMode === 'search' && ambiguousMatches && ambiguousMatches.length" class="ambiguous-list">
      <div class="ambiguous-list__title">
        Код найден у {{ ambiguousMatches.length }} {{ plural(ambiguousMatches.length, 'предмет', 'предмета', 'предметов') }} — выберите нужный:
      </div>
      <NuxtLink
        v-for="m in ambiguousMatches"
        :key="m.payload.id"
        :to="`/items/${m.payload.id}/edit`"
        class="ambiguous-card"
      >
        <ItemPhoto :images="m.payload.images" :alt="m.payload.title_print || m.payload.title" />

        <div class="ambiguous-card__info">
          <div class="ambiguous-card__title">{{ m.payload.title }}</div>
          <div v-if="m.payload.title_print" class="ambiguous-card__print">
            {{ m.payload.title_print }}
          </div>
          <div v-if="m.payload.user" class="ambiguous-card__owner">
            <span class="owner-name" :class="isOwner(m.payload.user) ? 'owner--me' : 'owner--other'">
              {{ m.payload.user.name }}
            </span>
          </div>
          <div v-if="matchChains[m.payload.id]" class="ambiguous-card__chain">
            {{ matchChains[m.payload.id] }}
          </div>
          <div v-if="m.payload.quantity != null" class="ambiguous-card__stock">
            В наличии: {{ m.payload.quantity }}
          </div>
        </div>
      </NuxtLink>
    </div>

    <!-- Безымянная этикетка: код в базе есть, но не привязан ни к чему.
         Это не ошибка, поэтому тон и оформление — сиреневые, а не красные.
         Дальше всё как у «не найдено»: можно завести предмет или хранилище. -->
    <div v-else-if="activeMode === 'search' && blankCode" class="blank-label">
      <div class="blank-label__text">Найдена безымянная этикетка</div>
      <div v-if="blankCode.set" class="blank-label__set">Набор: {{ blankCode.set.title }}</div>
      <div class="blank-label__ask">
        Добавить
        <NuxtLink :to="{ path: '/items/create', query: { code: blankCode.value } }" class="blank-label__link">
          предмет
        </NuxtLink>
        или
        <NuxtLink :to="{ path: '/stores/create', query: { code: blankCode.value } }" class="blank-label__link">
          хранилище
        </NuxtLink>
        ?
      </div>
      <div class="blank-label__code">Код: {{ blankCode.value }}</div>
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
        :key="keyOf(entry)"
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
        </div>

        <div class="scan-row__right">
            <div class="scan-row__top">
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
              @click="removeFromScanList(entry)"
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
        </div>

        <div class="scan-row__chain">
          <div class="scan-row__where">
            <span v-if="entry.payload.user && !entry.selectOpen" class="scan-row__owner">
              <span
                class="owner-name"
                :class="isOwner(entry.payload.user) ? 'owner--me' : 'owner--other'"
              >{{ entry.payload.user.name }}</span>
            </span>

            <div
              v-if="entry.selectOpen && !entry.done"
              :ref="(el) => setSelectRef(entry, el)"
              class="scan-row__select"
            >
              <button
                v-for="m in entry.matches"
                :key="m.id"
                type="button"
                class="scan-match"
                :class="{ 'scan-match--active': m.id === activeMatchId(entry) }"
                @mouseenter="entry.activeId = m.id"
                @click="applyMatch(entry, m)"
              >{{ selectLabel(m) }}</button>
            </div>

            <LocationChain
              v-else-if="!entry.selectOpen && scanChains[keyOf(entry)]?.length"
              :chain="scanChains[keyOf(entry)]"
            />
            <span v-else class="scan-row__none">Без склада</span>

            <button
              v-if="!entry.done"
              type="button"
              class="scan-pick"
              :disabled="entry.matches.length < 2"
              :title="entry.matches.length < 2 ? 'Выбирать нечего' : 'Выбрать предмет'"
              @mousedown.prevent
              @click="togglePick(entry)"
            >
              ▾ Выбрать
            </button>
          </div>
        </div>
      </div>

      <div class="scan-comment">
        <label class="scan-comment__label" for="scan-comment-input">
          Комментарий
          <span class="scan-comment__hint">(необязательно)</span>
        </label>
        <input
          id="scan-comment-input"
          v-model.trim="comment"
          type="text"
          class="scan-comment__input"
          :placeholder="activeMode === 'replenish'
            ? 'Например: приход от поставщика, заявка №12'
            : 'Например: ремонт в мастерской, брак'"
          :disabled="submitting"
          @keyup.enter="submitList"
        />
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
          <template v-if="!submitting && pendingEntries"> ({{ pendingEntries }}/{{ pendingTotal }})</template>
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CodeMatch, CodeSearchBlank, CodeSearchResponse, ItemPayload, StorePayload } from '~/repository/modules/code'
import type { OperationRow, OperationType } from '~/repository/modules/operation'
import type { OperationMode } from '~/composables/useOperationMode'
import type { ChainCrumb } from '~/composables/useLocationChain'

type Mode = OperationMode
type FoundResult =
  | { type: 'item'; payload: ItemPayload; code: string }
  | { type: 'store'; payload: StorePayload; code: string }

interface ScanEntry {
  code: string
  item_id: number
  payload: ItemPayload
  matches: ItemPayload[]
  count: number
  done: boolean
  doneAt: string
  doneDelta: number
  doneMode: Mode | null
  selectOpen: boolean
  activeId: number | null
}

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const { mode: savedMode, persist } = useOperationMode()
const { chainForStore } = useLocationChain()
const { isOwner } = useCurrentUser()

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
/** Найденная безымянная этикетка: код и набор, из которого он напечатан. */
const blankCode = ref<{ value: string; set: { id: number; title: string } | null } | null>(null)
const ambiguousMatches = ref<(CodeMatch & { payload: ItemPayload })[] | null>(null)
const scanList = ref<ScanEntry[]>([])
const foundChain = ref<ChainCrumb[]>([])
const scanChains = ref<Record<string, ChainCrumb[]>>({})
const matchChains = ref<Record<number, string>>({})
const submitting = ref(false)

// Комментарий на всю операцию: пользователь сканирует пачку кодов и объясняет
// её одним текстом — «куда списали». После отправки очищается: следующая пачка
// скорее всего имеет другую причину, иначе один текст молча приклеился бы к
// нескольким операциям подряд.
const comment = ref('')

// Уникальный ключ строки скана: один и тот же код у разных предметов —
// это разные строки (замесы не сливаются), у одного предмета две метки
// с разными кодами — тоже разные строки.
function keyOf(entry: ScanEntry): string {
  return `${entry.code}|${entry.item_id}`
}

const pendingEntries = computed(() => scanList.value.filter((entry) => !entry.done).length)

// Общее число предметов среди невыполненных строк (сумма количеств).
const pendingTotal = computed(() =>
  scanList.value
    .filter((entry) => !entry.done)
    .reduce((sum, entry) => sum + entry.count, 0),
)

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
  blankCode.value = null

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

  // Пополнить <-> Списать: список сохраняем — предметы не должны теряться
  // при переключении режима. Выполненные записи остаются со своими статусами.
  activeMode.value = mode
}

async function refreshFoundItem(code: string) {
  try {
    const result = await $api.code.search(code)
    if (activeMode.value !== 'search') return
    // Безымянная наклейка и неоднозначный код сюда не попадают: вызывающий
    // уже показал нужный экран, перерисовывать его незачем.
    if (isBlank(result) || isAmbiguous(result)) return
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
    ambiguousMatches.value = null
    notFoundCode.value = ''
    blankCode.value = null
  }

  try {
    const result = await $api.code.search(code)

    // Безымянная этикетка: код есть, привязки нет. В режиме поиска —
    // отдельный экран с предложением завести предмет или хранилище;
    // в режимах «Пополнить»/«Списать» она неприменима, там только
    // списание предметов, и предмета у кода ещё не существует.
    if (isBlank(result)) {
      if (activeMode.value === 'search') {
        blankCode.value = { value: result.code, set: result.label_set ?? null }
      } else {
        $notify.add('Это безымянная этикетка — создайте по ней предмет', { type: 'warning', timer: 6 })
        handleCodeNotFound(code)
      }
      return
    }

    if (isAmbiguous(result)) {
      const items = result.matches.filter(
        (m): m is CodeMatch & { payload: ItemPayload } => m.type === 'item' && m.payload !== null,
      )

      if (activeMode.value === 'search') {
        if (items.length === 0) {
          notFoundCode.value = code
        } else {
          ambiguousMatches.value = items
          void loadMatchChains(items.map((m) => m.payload))
        }
        return
      }

      clearDoneEntries()
      if (items.length === 0) {
        handleCodeNotFound(code)
        return
      }
      addToScanList(result.code, items[0]!.payload, items.map((m) => m.payload))
      return
    }

    if (result.type === 'item' && result.payload) {
      if (activeMode.value === 'search') {
        found.value = { type: 'item', payload: result.payload as ItemPayload, code: result.code }
        void refreshFoundChain()
      } else {
        clearDoneEntries()
        addToScanList(result.code, result.payload as ItemPayload)
      }
    } else if (result.type === 'store' && result.payload) {
      if (activeMode.value === 'search') {
        found.value = { type: 'store', payload: result.payload as StorePayload, code: result.code }
        void refreshFoundChain()
      } else {
        notifyStoreBlocked(result.payload as StorePayload)
      }
    } else if (activeMode.value === 'search') {
      notFoundCode.value = code
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

function isAmbiguous(result: CodeSearchResponse): result is CodeSearchResponse & { ambiguous: true; matches: CodeMatch[] } {
  return (result as { ambiguous?: unknown }).ambiguous === true
}

function isBlank(result: CodeSearchResponse): result is CodeSearchBlank {
  return (result as { blank?: unknown }).blank === true
}

function addToScanList(code: string, payload: ItemPayload, matches?: ItemPayload[]) {
  const matchList = matches && matches.length > 0 ? matches : [payload]
  const key = `${code}|${payload.id}`
  const existing = scanList.value.find((entry) => keyOf(entry) === key)
  if (existing) {
    // Повторное сканирование: увеличиваем количество к списанию/пополнению.
    // Для предметов без количества — всегда единственный экземпляр, ничего не делаем.
    if (payload.quantity != null) {
      existing.count += 1
    }
    return
  }
  scanList.value.push({
    code,
    item_id: payload.id,
    payload,
    matches: matchList,
    count: 1,
    done: false,
    doneAt: '',
    doneDelta: 0,
    doneMode: null,
    selectOpen: false,
    activeId: null,
  })
  void setScanChain(key, payload)
  if (matchList.length > 1) void loadMatchChains(matchList)
}

// Повторное сканирование: выполненные записи убираем, невыполненные сохраняем.
function clearDoneEntries() {
  const done = scanList.value.filter((entry) => entry.done)
  if (done.length === 0) return
  const keys = new Set(done.map((entry) => keyOf(entry)))
  scanList.value = scanList.value.filter((entry) => !entry.done)
  keys.forEach((key) => {
    delete scanChains.value[key]
  })
}

function clearList() {
  scanList.value = []
  scanChains.value = {}
  matchChains.value = {}
  comment.value = ''
}

async function setScanChain(key: string, payload: ItemPayload) {
  scanChains.value[key] = await chainForStore(payload.store_id)
}

function removeFromScanList(entry: ScanEntry) {
  const key = keyOf(entry)
  scanList.value = scanList.value.filter((item) => item !== entry)
  delete scanChains.value[key]
  entry.matches.forEach((m) => delete matchChains.value[m.id])
}

// Цепочка каждого кандидата для селекта: «Склад → … → Шкаф» (или «Без склада»).
async function loadMatchChains(matchList: ItemPayload[]) {
  for (const m of matchList) {
    if (matchChains.value[m.id]) continue
    const chain = await chainForStore(m.store_id)
    matchChains.value[m.id] = chain.length
      ? chain.map((c) => c.title).join(' → ')
      : 'Без склада'
  }
}

function matchOwnerName(m: ItemPayload): string {
  if (m.user?.name) return m.user.name
  if (m.user?.email) return m.user.email
  return m.user_id != null ? `Пользователь #${m.user_id}` : '—'
}

function selectLabel(m: ItemPayload): string {
  return `[${matchOwnerName(m)}] ${matchChains.value[m.id] ?? '…'}`
}

function togglePick(entry: ScanEntry) {
  if (entry.matches.length < 2 || entry.done) return

  if (entry.selectOpen) {
    entry.selectOpen = false
    return
  }

  entry.selectOpen = true
  entry.activeId = entry.item_id
  void loadMatchChains(entry.matches)
}

const selectRefs = new Map<string, HTMLElement>()

function setSelectRef(entry: ScanEntry, el: unknown) {
  const key = keyOf(entry)
  if (el instanceof HTMLElement) {
    selectRefs.set(key, el)
  } else {
    selectRefs.delete(key)
  }
}

function activeMatchId(entry: ScanEntry): number {
  return entry.activeId ?? entry.item_id
}

// Клик вне раскрытого списка подтверждает текущий активный пункт —
// строка переходит в состояние «выбрано» (чип владельца + цепочка).
function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement | null

  // Кнопку «Выбрать» обрабатывает её собственный @click.
  if (target?.closest('.scan-pick')) return

  for (const entry of scanList.value) {
    if (!entry.selectOpen) continue
    const el = selectRefs.get(keyOf(entry))
    if (el && target && (el === target || el.contains(target))) continue
    commitCurrentOption(entry)
  }
}

function commitCurrentOption(entry: ScanEntry) {
  const match = entry.matches.find((m) => m.id === activeMatchId(entry))
  if (match) {
    applyMatch(entry, match)
  } else {
    entry.selectOpen = false
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})

function applyMatch(entry: ScanEntry, match: ItemPayload) {
  entry.selectOpen = false
  entry.activeId = null
  if (entry.item_id === match.id) return
  const oldKey = keyOf(entry)
  entry.item_id = match.id
  entry.payload = match
  entry.count = 1
  delete scanChains.value[oldKey]
  void setScanChain(keyOf(entry), match)
}

// Код не найден: переключаемся в «Поиск» и показываем предложение
// добавить предмет или хранилище.
function handleCodeNotFound(code: string) {
  activeMode.value = 'search'
  found.value = null
  foundChain.value = []
  ambiguousMatches.value = null
  scanList.value = []
  scanChains.value = {}
  matchChains.value = {}
  notFoundCode.value = code
  blankCode.value = null
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
    ...(entry.matches.length > 1 ? { item_id: entry.item_id } : {}),
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
    const result = await $api.operation.store({
      type,
      payload: rows,
      comment: comment.value || null,
    })
    const rowsByKey = new Map((result?.rows ?? []).map((row) => [`${row.code}|${row.item_id}`, row]))
    const now = new Date().toISOString()

    for (const entry of pending) {
      const applied = rowsByKey.get(keyOf(entry))
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
    // Уведомление выводится текстом, а не HTML, поэтому здесь нужен настоящий
    // знак «минус», а не сущность &minus; — она попадала в текст как есть.
    const sign = isReplenish ? '+' : '−'
    const verb = isReplenish ? 'Пополнено' : 'Списано'
    comment.value = ''
    // «позиция» — это строка операции, «шт.» — единицы внутри неё. Раньше здесь
    // стояло «предмет», и при списании одного наименования пачкой сообщение
    // читалось как противоречие: «1 предмет (−10 шт.)».
    $notify.add(
      `${verb}: ${rows.length} ${plural(rows.length, 'позиция', 'позиции', 'позиций')} (${sign}${deltaSum} шт.)`,
      {
        type: 'success',
        timer: 6,
      }
    )
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка операции'), { type: 'error', timer: 10 })
  } finally {
    submitting.value = false
  }
}

/**
 * Согласование существительного с числом: 1 предмет, 2 предмета, 5 предметов.
 * Русские правила не сводятся к «последняя цифра»: 11, 12, 13, 14 уходят
 * в форму множественного, хотя оканчиваются на 1-4.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
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
