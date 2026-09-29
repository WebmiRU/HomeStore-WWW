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
        <span class="mode-label">{{ t('options_page.mode_search') }}</span>
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
        <span class="mode-label">{{ t('options_page.mode_replenish') }}</span>
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
        <span class="mode-label">{{ t('options_page.mode_writeoff') }}</span>
      </button>
    </div>

    <!-- Режим «Поиск»: код найден ровно у одного предмета или хранилища -->
    <!--
      Та же карточка (ItemCard), что в строке сканирования и в модалке выбора.
      Раньше здесь была отдельная вёрстка с шапкой, своей сеткой и полем
      количества, и карточка выдачи поиска выглядела иначе, хотя показывала
      тот же предмет.
    -->
    <div v-if="activeMode === 'search' && found" class="found">
      <!--
        Отдельной кнопки «Открыть» больше нет: название само ведёт в карточку,
        и две ссылки на одно и то же место рядом только отвлекали.
      -->
      <ItemCard
        :item="found.payload"
        :code="found.code"
        :kind="found.type"
        :chain="foundChain"
        :title-to="foundLink"
      />
    </div>

    <!-- Несколько предметов с одним кодом: показываем все варианты -->
    <div v-else-if="activeMode === 'search' && ambiguousMatches && ambiguousMatches.length" class="ambiguous-list">
      <div class="ambiguous-list__title">
        {{ t('main.ambiguous_found', { count: tp('words.item_nom', ambiguousMatches.length) }) }}
      </div>
      <!--
        Карточка предмета — общая (ItemCard), ровно как в модалке выбора при
        сканировании. Оба экрана показывают один и тот же список, и держать
        для них две разные карточки значит получить расхождение: выбрал в
        одном месте, сверился в другом — а выглядят они по-разному.

        Вся карточка ссылкой не делается: ссылка только на названии, а по
        остальному месту карточка выбирает предмет — и в списке из нескольких
        клик мимо ссылки приводит к тому, что выбрался не тот.
      -->
      <ItemCard
        v-for="m in ambiguousMatches"
        :key="m.payload.id"
        :item="m.payload"
        :code="m.code"
        :collision-count="ambiguousMatches.length"
        :chain="matchChains[m.payload.id] ?? []"
        :title-to="`/items/${m.payload.id}`"
      />
    </div>

    <!-- Безымянная этикетка: код в базе есть, но не привязан ни к чему.
         Это не ошибка, поэтому тон и оформление — сиреневые, а не красные.
         Дальше всё как у «не найдено»: можно завести предмет или хранилище. -->
    <div v-else-if="activeMode === 'search' && blankCode" class="blank-label">
      <div class="blank-label__text">{{ t('main.blank_code_title') }}</div>
      <div v-if="blankCode.set" class="blank-label__set">{{ t('main.set_label') }}: {{ blankCode.set.title }}</div>
      <div class="blank-label__ask">
        {{ t('main.add_word') }}
        <NuxtLink :to="{ path: '/items/create', query: { code: blankCode.value } }" class="blank-label__link">
          {{ t('main.item_word') }}
        </NuxtLink>
        {{ t('main.or_word') }}
        <NuxtLink :to="{ path: '/stores/create', query: { code: blankCode.value } }" class="blank-label__link">
          {{ t('main.store_word') }}
        </NuxtLink>
        ?
      </div>
      <div class="blank-label__code">{{ t('form.code') }}: {{ blankCode.value }}</div>
    </div>

    <div v-else-if="activeMode === 'search' && notFoundCode" class="not-found">
      <div class="not-found__text">{{ t('main.not_found') }}</div>
      <div class="not-found__ask">
        {{ t('main.add_word') }}
        <NuxtLink :to="{ path: '/items/create', query: { code: notFoundCode } }" class="not-found__link">
          {{ t('main.item_word') }}
        </NuxtLink>
        {{ t('main.or_word') }}
        <NuxtLink :to="{ path: '/stores/create', query: { code: notFoundCode } }" class="not-found__link">
          {{ t('main.store_word') }}
        </NuxtLink>
        ?
      </div>
      <div class="not-found__code">{{ t('form.code') }}: {{ notFoundCode }}</div>
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
        :title-to="`/items/${entry.item_id}`"
      >
          <template #foot>
            <div v-if="!entry.done && isPartialEntry(entry)" class="item-card__stock">
              <!--
                Два числа рядом: сколько осталось по складу и, в скобках,
                сколько в той штуке, которая расходуется сейчас. Без второго
                нельзя понять, докуда пойдёт следующий шаг.
              -->
              <span v-for="part in entry.parts" :key="part.property_id" class="scan-row__left">
                {{ part.title }}: {{ entry.partStock[part.property_id] ?? 0 }}
                ({{ part.remaining ?? 0 }})
              </span>
            </div>
            <div v-else-if="!entry.done && entry.payload.quantity != null" class="item-card__stock">
              {{ t('main.in_stock', { count: entry.payload.quantity }) }}
            </div>
            <div v-else-if="entry.done" class="item-card__stock">
              <span
                class="scan-row__done"
                :class="`scan-row__done--${entry.doneMode}`"
                :title="t('main.done_at', { date: formatDate(entry.doneAt) })"
              >
                {{ entry.doneMode === 'replenish' ? t('main.done_replenish') : t('main.done_writeoff') }}
              </span>
              <span class="scan-row__residue">
                {{ t('balance.remainder') }}: {{ entry.payload.quantity }}
                ({{ entry.doneMode === 'replenish' ? '+' : '−' }}{{ entry.doneDelta }})
              </span>
            </div>
            <div v-if="!entry.done && entry.payload.quantity == null" class="scan-row__hint">
              {{ t('item_card.single_hint') }}
            </div>
            <div v-if="!entry.done && entryProblem(entry) !== null" class="scan-row__hint scan-row__hint--error">
              {{ entryProblem(entry) }}
            </div>
          </template>

          <template #side>
            <div class="scan-row__action">
              <template v-if="!entry.done">
                <!--
                  У предмета, который живёт по кодам, количество равно числу
                  кодов, и менять его в строке нельзя: списание по коду снимает
                  ровно единицу за штуку. Показываем 1 и гасим поле, чтобы
                  было видно, что количество задано самими кодами.
                -->
                <span v-if="entry.payload.release_code_on_writeoff" class="scan-row__whole">
                  1 {{ t('units.pcs') }}
                </span>

                <!--
                  Расходуемый предмет: полей столько, сколько у него
                  расходуемых свойств, и в каждом — сколько забрать. Значение
                  по умолчанию взято из шага настройки, но правится здесь,
                  до отправки: за один скан у мешка уходит и картошка, и рис.
                -->
                <div v-else-if="isPartialEntry(entry)" class="scan-row__parts">
                  <label
                    v-for="part in entry.parts"
                    :key="part.property_id"
                    class="scan-row__part"
                  >
                    <span class="scan-row__part-title">{{ part.title }}</span>
                    <input
                      v-model.number="part.amount"
                      type="number"
                      min="0"
                      step="any"
                      class="scan-row__part-input"
                    >
                    <span class="scan-row__part-stock">
                      {{ t('main.partial_left') }}: {{ entry.partStock[part.property_id] ?? 0 }}
                    </span>
                  </label>
                </div>

                <input
                  v-else-if="entry.payload.quantity != null"
                  v-model.number="entry.count"
                  type="number"
                  min="1"
                  step="1"
                  class="scan-row__count"
                />
                <span v-else class="scan-row__whole">1 {{ t('units.pcs') }}</span>
              </template>
            </div>

            <button
              type="button"
              class="scan-row__remove"
              :aria-label="t('main.delete_entry', { title: entry.payload.title })"
              :title="t('common.delete')"
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
          {{ t('movements.comment') }}
          <span class="scan-comment__hint">{{ t('main.optional') }}</span>
        </label>
        <input
          id="scan-comment-input"
          v-model.trim="comment"
          type="text"
          class="scan-comment__input"
          :placeholder="activeMode === 'replenish'
            ? t('main.comment_replenish_hint')
            : t('main.comment_writeoff_hint')"
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
          {{ submitting ? t('main.submitting') : activeMode === 'replenish' ? t('options_page.mode_replenish') : t('options_page.mode_writeoff') }}
          <!--
            Сумма штук в скобках показывается, только когда в списке нет
            расходуемых строк. У них количество не вводится, а остаётся тем, что
            показал сервер, и сумма получилась бы вроде «3/0» — а ноль штук
            при трёх позициях это неправда.
          -->
          <template v-if="!submitting && pendingEntries && !hasPartialEntries">
            ({{ pendingEntries }}/{{ pendingTotal }})
          </template>
          <template v-else-if="!submitting && pendingEntries"> ({{ pendingEntries }})</template>
        </button>

        <button
          v-if="scanList.length"
          type="button"
          class="scan-reset"
          :disabled="submitting"
          :title="t('main.clear')"
          @click="clearList"
        >
          {{ t('common.reset') }}
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
import type { CodeMatch, CodeSearchBlank, CodeSearchResponse, ItemPartialProperty, ItemPayload, StorePayload } from '~/repository/modules/code'
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
  /**
   * Расход по свойствам, предлагаемый в строке: сколько списать по каждому.
   *
   * Живёт в строке, а не в payload предмета: это то, что человек правит
   * перед отправкой, а не состояние склада. Значения по умолчанию — шаги из
   * настроек предмета, и их можно менять хоть в последнюю секунду.
   */
  parts: EntryPart[]
  /** Остатки по свойствам до отправки: нужны, чтобы показать, что списать нельзя. */
  partStock: Record<number, number>
}

/** Одно поле расхода в строке скана. */
interface EntryPart {
  property_id: number
  title: string
  amount: number
  step: number
  norm: number
  /** Остаток внутри текущей штуки: показывается в скобках рядом с общим. */
  remaining: number
}

const { $api, $notify } = useNuxtApp()
const { t, tp } = useI18n()
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

/**
 * Общее число предметов среди невыполненных строк (сумма количеств).
 *
 * Строки частичного расхода не в счёт: у них количество штук не то, что
 * вводилось, а остаётся тем, что показал сервер. Считать их по шагу значило бы
 * показать в сводке число, которого на складе нет.
 */
/** Есть ли в списке расходуемые строки: у них своя арифметика. */
const hasPartialEntries = computed(() => scanList.value.some((entry) => !entry.done && isPartialEntry(entry)))

const pendingTotal = computed(() =>
  scanList.value
    .filter((entry) => !entry.done && !isPartialEntry(entry))
    .reduce((sum, entry) => sum + entry.count, 0),
)

/**
 * Расходуемые свойства предмета или null, если он расходуется штуками.
 *
 * Отдельная проверка вместо «по флагу»: флаг мог остаться в предмете от прежней
 * настройки, а свойства убрали, и тогда строка предлагала бы расход по
 * свойствам, которых у предмета нет. Расход определяется настройками.
 */
function partialOf(payload: ItemPayload): ItemPartialProperty[] | null {
  const partial = payload.partial

  return partial !== undefined && partial.length > 0 ? partial : null
}

/** Расходуемый ли предмет: расход идёт по свойствам, а не штуками. */
function isPartialEntry(entry: ScanEntry): boolean {
  return entry.parts.length > 0
}

/** Число с тремя знаками: расход накапливается шагами, и копейки не нужны. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Сколько расхода по свойству в строке. */
function partAmount(entry: ScanEntry, propertyId: number): number {
  return entry.parts.find((part) => part.property_id === propertyId)?.amount ?? 0
}

// Причина, по которой строку нельзя отправить в операции (или null — можно).
function entryProblem(entry: ScanEntry): string | null {
  if (entry.done) return null

  // Расходуемый предмет проверяется по свойствам, а не по количеству штук:
  // количество у него меняет сервер, когда опустела штука, и сравнивать с ним
  // расход по свойству бессмысленно.
  if (isPartialEntry(entry)) {
    for (const part of entry.parts) {
      if (!Number.isFinite(part.amount) || part.amount <= 0) {
        return t('main.partial_amount_hint')
      }

      // Пополнение не ограничено остатком: принести можно и больше, чем было.
      if (activeMode.value === 'writeoff' && part.amount - (entry.partStock[part.property_id] ?? 0) > 0.001) {
        return t('main.partial_stock_line', { title: part.title, total: entry.partStock[part.property_id] ?? 0 })
      }
    }
    return null
  }

  if (!Number.isInteger(entry.count) || entry.count < 1) {
    return t('main.quantity_hint')
  }
  if (activeMode.value === 'writeoff' && entry.payload.quantity != null && entry.count > entry.payload.quantity) {
    return t('main.stock_line', { quantity: entry.payload.quantity, count: entry.count })
  }
  return null
}

const isListMode = computed(
  () => activeMode.value === 'replenish' || activeMode.value === 'writeoff',
)

const listTitle = computed(() =>
  activeMode.value === 'replenish' ? t('main.mode_replenish_noun') : t('main.mode_writeoff_noun'),
)

/**
 * Адрес карточки для найденного: у предмета и хранилища он разный.
 *
 * Раньше здесь была кнопка «Открыть» с тем же адресом; она убрана, потому что
 * название и так ведёт в карточку, а две ссылки на одно место рядом только
 * отвлекают.
 */
const foundLink = computed(() => {
  if (!found.value) return null
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
        $notify.add(t('main.blank_label_hint'), { type: 'warning', timer: 6 })
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
        $notify.add(formatApiError(err, t('notify.search_failed')), { type: 'error', timer: 10 })
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
    t('main.item_not_chosen', { code: request.code }),
    { type: 'warning', timer: 6 },
  )
}

function addToScanList(code: string, payload: ItemPayload, matches?: ItemPayload[]) {
  const matchList = matches && matches.length > 0 ? matches : [payload]
  const key = `${code}|${payload.id}`
  const existing = scanList.value.find((entry) => keyOf(entry) === key)

  if (existing) {
    // Повторное сканирование того же кода: у обычного предмета это означает
    // «списать ещё одну такую же», и количество растёт.
    //
    // У предмета, который живёт по кодам, иначе: там 1 код = 1 единица, и код
    // при списании высвобождается. Повтор того же кода не должен ни удваивать
    // количество, ни ждать, пока тот же код спишут второй раз, — он уже занят
    // в первой строке. Просто ничего не делаем.
    if (payload.release_code_on_writeoff) {
      return
    }

    // У расходуемого предмета повторный скан означает «ещё шаг по каждому
    // свойству», а не «ещё одну штуку»: бутылку списали на 200 мл, отсканировали
    // снова — списали ещё 200. Количество штук у такого предмета меняет сам
    // сервер, когда опустеет штука, и набирать его вручную нельзя.
    if (partialOf(payload) !== null) {
      partialOf(payload)!.forEach((property) => {
        const part = existing.parts.find((item) => item.property_id === property.property_id)

        if (part) {
          part.amount = round3(part.amount + property.step)
        }
      })
      return
    }

    // Для предметов без количества — всегда единственный экземпляр, ничего не делаем.
    if (payload.quantity != null) {
      existing.count += 1
    }
    return
  }
  const partial = partialOf(payload)

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
    parts: partial === null
      ? []
      : partial.map((property) => ({
          property_id: property.property_id,
          title: property.property_title ?? String(property.property_id),
          amount: property.step,
          step: property.step,
          norm: property.norm,
        })),
    partStock: partial === null
      ? {}
      : Object.fromEntries(partial.map((property) => [property.property_id, property.total])),
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
  $notify.add(
    t('main.store_not_allowed', {
      title: store.title,
      action: t(activeMode.value === 'replenish' ? 'main.verb_replenish' : 'main.verb_writeoff'),
    }),
    { type: 'warning', timer: 10 },
  )
}

async function submitList() {
  if (submitting.value) return

  const pending = scanList.value.filter((entry) => !entry.done)
  const rows: OperationRow[] = pending.map((entry) => ({
    code: entry.code,
    ...(entry.matches.length > 1 ? { item_id: entry.item_id } : {}),
    // У расходуемого предмета расход идёт в parts, а количество не отправляется:
    // сервер сам решает, сколько штук из этого ушло, по опустевшим свойствам.
    ...(isPartialEntry(entry)
      ? {
          parts: entry.parts.map((part) => ({
            property_id: part.property_id,
            amount: part.amount,
          })),
        }
      : { quantity: entry.payload.quantity != null ? entry.count : 1 }),
  }))

  if (rows.length === 0) {
    $notify.add(t('main.no_items_for_operation'), { type: 'warning', timer: 5 })
    return
  }

  const problems = pending
    .map((entry) => ({ entry, problem: entryProblem(entry) }))
    .filter((item): item is { entry: ScanEntry; problem: string } => item.problem !== null)

  if (problems.length > 0) {
    const details = problems
      .map((item) => `«${item.entry.payload.title}»: ${item.problem}`)
      .join('; ')
    $notify.add(t('main.operation_failed', { details }), { type: 'error', timer: 12 })
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
      const sign = isReplenish ? 1 : -1

      if (isPartialEntry(entry)) {
        // Количество штук меняет сервер, и в ответе оно уже новое. Остатки по
        // свойствам сервер не отдаёт, поэтому они считаются здесь: на величину
        // расхода, с ограничением снизу нулём.
        if (applied) {
          entry.payload.quantity = applied.after
          entry.doneDelta = applied.delta
        }

        for (const part of entry.parts) {
          entry.partStock[part.property_id] = Math.max(
            0,
            round3((entry.partStock[part.property_id] ?? 0) + sign * part.amount),
          )
        }
      } else if (applied) {
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

    // Сумма в уведомлении — одна цифра, а у расходуемых строк величины разные
    // и несводимые: 300 мл сиропа и 20 кг риса не складываются в «−5». У
    // таких строк показывается число позиций расхода, а не сумма штук.
    const hasPartialRows = rows.some((row) => row.parts !== undefined)
    const deltaSum = hasPartialRows
      ? 0
      : rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
    // Уведомление выводится текстом, а не HTML, поэтому здесь нужен настоящий
    // знак «минус», а не сущность &minus; — она попадала в текст как есть.
    const sign = isReplenish ? '+' : '−'
    const verb = isReplenish ? t('main.done_replenish') : t('main.done_writeoff')
    comment.value = ''
    // «позиция» — это строка операции, «шт.» — единицы внутри неё. Раньше здесь
    // стояло «предмет», и при списании одного наименования пачкой сообщение
    // читалось как противоречие: «1 предмет (−10 шт.)».
    $notify.add(
      hasPartialRows
        ? t('main.operation_done_partial', { verb, count: tp('words.position', rows.length) })
        : t('main.operation_done', { verb, count: tp('words.position', rows.length), amount: `${sign}${deltaSum}` }),
      {
        type: 'success',
        timer: 6,
      }
    )
  } catch (err: any) {
    $notify.add(formatApiError(err, t('main.operation_failed_short')), { type: 'error', timer: 10 })
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
