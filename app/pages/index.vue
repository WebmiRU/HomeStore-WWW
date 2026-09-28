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

    <!-- Режим «Поиск»: код найден ровно у одного предмета или хранилища -->
    <!--
      Та же карточка (ItemCard), что в строке сканирования и в модалке выбора.
      Отличие одно: в правой колонке — там, где в операции стоит счётчик, —
      кнопка «Открыть». Раньше здесь была отдельная вёрстка с шапкой, своей
      сеткой и полем количества, и карточка выдачи поиска выглядела иначе,
      хотя показывала тот же предмет.
    -->
    <div v-if="activeMode === 'search' && found" class="found">
      <ItemCard :item="found.payload" :code="found.code" :kind="found.type" :chain="foundChain">
        <template #side>
          <NuxtLink class="item-card__open" :to="editLink">Открыть</NuxtLink>
        </template>
      </ItemCard>
    </div>

    <!-- Несколько предметов с одним кодом: показываем все варианты -->
    <div v-else-if="activeMode === 'search' && ambiguousMatches && ambiguousMatches.length" class="ambiguous-list">
      <div class="ambiguous-list__title">
        Код найден у {{ ambiguousMatches.length }} {{ plural(ambiguousMatches.length, 'предмет', 'предмета', 'предметов') }} — выберите нужный:
      </div>
      <!--
        Карточка предмета — общая (ItemCard), ровно как в модалке выбора при
        сканировании. Оба экрана показывают один и тот же список, и держать
        для них две разные карточки значит получить расхождение: выбрал в
        одном месте, сверился в другом — а выглядят они по-разному.

        Вся карточка ссылкой не делается: в списке из нескольких предметов
        клик мимо кнопки «Открыть» приводит к тому, что открылся не тот.
      -->
      <ItemCard
        v-for="m in ambiguousMatches"
        :key="m.payload.id"
        :item="m.payload"
        :code="m.code"
        :collision-count="ambiguousMatches.length"
        :chain="matchChains[m.payload.id] ?? []"
      >
        <template #side>
          <NuxtLink class="item-card__open" :to="`/items/${m.payload.id}`">Открыть</NuxtLink>
        </template>
      </ItemCard>
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
      <!--
          Карточка предмета — общая (ItemCard), ровно та же, что в модалке
          выбора при неоднозначном коде и в выдаче поиска. Здесь отличаются
          только слоты: снизу состояние операции, справа счётчик и удаление.
        -->
      <ItemCard
        v-for="entry in scanList"
        :key="keyOf(entry)"
        class="scan-row"
        :class="[
          entry.done ? ['scan-row--done', `scan-row--done--${entry.doneMode}`] : '',
          !entry.done && entryProblem(entry) !== null ? 'scan-row--invalid' : '',
        ]"
        :item="entry.payload"
        :code="entry.code"
        :collision-count="entry.matches.length"
        :chain="scanChains[keyOf(entry)] ?? []"
      >
          <template #foot>
            <div v-if="!entry.done && entry.payload.quantity != null" class="item-card__stock">
              В наличии: {{ entry.payload.quantity }}
            </div>
            <div v-else-if="entry.done" class="item-card__stock">
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
          </template>

          <template #side>
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
          </template>
      </ItemCard>

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
            ? 'Например: приход от производителя, заявка №12'
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

    <CodeAmbiguityDialog
      :request="currentAmbiguity"
      :pendingCount="ambiguityPending"
      @choose="onAmbiguityChosen"
      @cancel="onAmbiguityCancelled"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CodeMatch, CodeSearchBlank, CodeSearchResponse, ItemPayload, StorePayload } from '~/repository/modules/code'
import type { OperationRow, OperationType } from '~/repository/modules/operation'
import type { OperationMode } from '~/composables/useOperationMode'
import type { ChainCrumb } from '~/composables/useLocationChain'
import { plural } from '~/utils/plural'

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

// Режим приходит из настроек, и настройки загружаются после монтирования:
// сначала показываем умолчание, а сохранённый режим встаёт сам, как только
// ответ придёт. Поэтому следим за источником, а не копируем его один раз.
const activeMode = ref<Mode>(savedMode.value)

watch(savedMode, (next) => {
  activeMode.value = next
})

const found = ref<FoundResult | null>(null)
const notFoundCode = ref('')
/** Найденная безымянная этикетка: код и набор, из которого он напечатан. */
const blankCode = ref<{ value: string; set: { id: number; title: string } | null } | null>(null)
const ambiguousMatches = ref<(CodeMatch & { payload: ItemPayload })[] | null>(null)
/**
 * Что человек выбрал руками для неоднозначного кода: код -> id предмета.
 *
 * Живёт отдельно от scanList, а не берётся оттуда: строка может быть
 * убрана, а сканы этого кода продолжатся. Именно эта память делает серию
 * сканирований предсказуемой — см. onAmbiguityChosen.
 */
const chosenMatchByCode = ref<Record<string, number>>({})

// Тип запроса выбора импортируется из компонента окна: он и есть контракт
// между страницей и окном, и объявлять его второй раз здесь не нужно.
import type { AmbiguityRequest } from '~/components/CodeAmbiguityDialog.vue'
const scanList = ref<ScanEntry[]>([])
const foundChain = ref<ChainCrumb[]>([])
const scanChains = ref<Record<string, ChainCrumb[]>>({})
const matchChains = ref<Record<number, ChainCrumb[]>>({})
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

const isListMode = computed(
  () => activeMode.value === 'replenish' || activeMode.value === 'writeoff',
)

const listTitle = computed(() =>
  activeMode.value === 'replenish' ? 'Пополнение' : 'Списание',
)

const editLink = computed(() => {
  if (!found.value) return ''
  return found.value.type === 'item'
    ? `/items/${found.value.payload.id}`
    : `/stores/${found.value.payload.id}`
})

function setMode(mode: Mode) {
  const prev = activeMode.value
  if (prev === mode) return

  // Запоминаем выбранный режим в настройках: при следующем сканировании
  // (с любой страницы и на любом устройстве) автоматически включится он же.
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
        // Из режима операций тоже показываем сиреневый блок, а не красный
        // «Код не найден в Базе»: код-то найден, отсутствие привязки здесь не
        // ошибка, а нормальный этап жизни наклейки.
        handleBlankCode(result.code, result.label_set ?? null)
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
      // Неоднозначный код в режимах операций требует выбора: молча поставить
      // «первый» предмет — это тихое списание не того, а человек узнаёт об
      // ошибке из остатков через месяц. Сканы, пришедшие пока окно открыто,
      // встают в очередь и разбираются по одному.
      ambiguityQueue.value = [
        ...ambiguityQueue.value,
        {
          code: result.code,
          items: items.map((m) => m.payload),
          preselectedId: chosenMatchByCode.value[result.code] ?? null,
        },
      ]
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

/**
 * Очередь неоднозначных сканов: окно выбора открыто на один, остальные ждут.
 *
 * Порядок сохраняется, поэтому счёт «сколько отсканировал» совпадает с тем,
 * что человек видит. Пропущенный запрос не занимает очередь: человек его
 * отменил осознанно.
 */
const ambiguityQueue = ref<AmbiguityRequest[]>([])

/** Первое из ожидающих — его и показываем. */
const currentAmbiguity = computed<AmbiguityRequest | null>(() => ambiguityQueue.value[0] ?? null)

/** Сколько ещё ждёт после текущего: подсказка в окне, что работа не кончилась. */
const ambiguityPending = computed(() => Math.max(ambiguityQueue.value.length - 1, 0))

/** Выбор в окне: предмет попадает в список обычным путём, как при точном скане. */
function onAmbiguityChosen(item: ItemPayload) {
  const request = currentAmbiguity.value
  if (!request) return

  ambiguityQueue.value = ambiguityQueue.value.slice(1)
  // Выбор запоминается и подсвечивается в следующем окне того же кода:
  // подтверждать одно и то же второй раз — по кнопке, а не по размышлению.
  chosenMatchByCode.value = { ...chosenMatchByCode.value, [request.code]: item.id }
  addToScanList(request.code, item, request.items)
}

/**
 * Отмена выбора: предмет в список не попадает.
 *
 * Добавить «невыбранный» строку значило бы списать что-то наугад — ровно то,
 * ради чего окно и открывается. Штука остаётся на месте, её можно
 * отсканировать снова.
 */
function onAmbiguityCancelled() {
  const request = currentAmbiguity.value
  if (!request) return

  ambiguityQueue.value = ambiguityQueue.value.slice(1)
  $notify.add(
    `Код ${request.code}: предмет не выбран, штука не учтена. Отсканируйте ещё раз.`,
    { type: 'warning', timer: 6 },
  )
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
  // Выборы относятся к этой же сессии: следующая пачка — другая работа, и
  // тянуть в неё решения, принятые по другой коллизии, незачем.
  chosenMatchByCode.value = {}
  ambiguityQueue.value = []
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

// Цепочка хранения каждого кандидата — для карточки выдачи поиска. Хранится
// именно цепочкой, а не готовой строкой: карточка рисует её сама, через
// LocationChain, как и строка сканирования.
async function loadMatchChains(matchList: ItemPayload[]) {
  for (const m of matchList) {
    if (matchChains.value[m.id]) continue
    matchChains.value[m.id] = await chainForStore(m.store_id)
  }
}

/**
 * Безымянная этикетка из режима операций: переключаемся в «Поиск» и
 * показываем сиреневый блок с предложением завести предмет или хранилище.
 *
 * Отдельная функция нужна ради одной строки: раньше отсюда вызывался
 * handleCodeNotFound, и на главной появлялось «Код не найден в Базе» про
 * код, который только что напечатали, — обидно и неверно.
 */
function handleBlankCode(code: string, set: { id: number; title: string } | null) {
  activeMode.value = 'search'
  found.value = null
  foundChain.value = []
  ambiguousMatches.value = null
  scanList.value = []
  scanChains.value = {}
  matchChains.value = {}
  notFoundCode.value = ''
  blankCode.value = { value: code, set }
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
