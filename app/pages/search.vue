<template>
  <div class="search-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('search.title', { query }) }}</h3>
      <MassLabelListButton
        :item-ids="selectedItemIds"
        :store-ids="selectedStoreIds"
        @done="clearSelection"
      />
    </div>

    <div v-if="loading" class="loading">
      <SpinnerIcon :size="36" />
      <span class="loading-text">{{ t('search.searching') }}</span>
    </div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <div v-if="results.length === 0" class="empty">{{ t('search.empty') }}</div>

      <table v-else class="results-table">
        <thead>
          <tr>
            <th class="cb-col">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate.prop="someSelected && !allSelected"
                @change="toggleAll"
              />
            </th>
            <th class="img-col">{{ t('list_common.photo') }}</th>
            <th>{{ t('search.type') }}</th>
            <th>{{ t('common.title') }}</th>
            <th></th>
          </tr>
        </thead>
        <template v-for="r in pageResults" :key="`${r.type}-${r.payload.id}`">
          <tbody class="result-group">
            <!--
              Двойной клик открывает карточку — как в индексных таблицах.
              Находки в поиске смотрят глазами и часто сразу идут смотреть
              подробности; искать глазом иконку правки в конце строки каждый
              раз незачем. Клик по ссылке, кнопке или полю ввода не считается:
              двойной клик по чекбоксу отмечал бы предмет, а не открывал его.
            -->
            <tr @dblclick="openRow($event, r.type === 'item' ? `/items/${r.payload.id}` : `/stores/${r.payload.id}`)">
              <td class="cb-col">
              <input
                type="checkbox"
                :checked="isSelected(r)"
                @change="toggleOne(r)"
              />
            </td>
            <td class="img-col" :data-label="t('list_common.photo')">
              <!-- Размер здесь больше, чем в списке предметов: в поиске смотрят
                   сами находки, а не список, и картинка нужна, чтобы узнать
                   предмет. При этом она всё равно много компактнее прежних
                   84px по умолчанию — те растягивали строку и съедали
                   «Название». -->
              <ItemPhoto :images="r.payload.images" :alt="r.payload.title" :size="70" lightbox />
            </td>
            <td :data-label="t('search.type')">
              <span v-if="r.type === 'item'" class="type-badge type-item">{{ t('search.type_item') }}</span>
              <span v-else class="type-badge type-store">{{ t('search.type_store') }}</span>
            </td>
            <td :data-label="t('common.title')">
              <div class="result-title">{{ r.payload.title }}</div>
              <div v-if="r.payload.title_print" class="result-sub">{{ r.payload.title_print }}</div>
            </td>
            <td class="actions">
              <div class="action-grid">
                <LabelListToggler
                  v-if="r.type === 'item'"
                  :item-id="r.payload.id"
                  :in-any-list="itemsInLists.has(r.payload.id)"
                  @changed="onTogglerChanged"
                />
                <LabelListToggler
                  v-else
                  :store-id="r.payload.id"
                  :in-any-list="storesInLists.has(r.payload.id)"
                  @changed="onTogglerChanged"
                />
                <NuxtLink
                  :to="r.type === 'item' ? `/items/${r.payload.id}` : `/stores/${r.payload.id}`"
                  class="action-link"
                  :class="canEdit(r) ? 'action-edit' : 'action-view'"
                  :title="canEdit(r) ? t('common.edit') : t('common.open')"
                  :aria-label="canEdit(r) ? t('common.edit') : t('common.open')"
                >
                  <img :src="canEdit(r) ? '/img/icon/edit.svg' : '/img/icon/view.svg'" class="action-icon" alt="" />
                </NuxtLink>
                <template v-if="r.type === 'item'">
                  <button
                    type="button"
                    class="action-btn action-btn--replenish"
                    :disabled="!r.payload.code"
                    :title="r.payload.code ? t('search.replenish_title', { title: r.payload.title }) : t('search.no_code')"
                    :aria-label="t('options_page.mode_replenish')"
                    @click="goReplenish(r)"
                  >
                    <svg
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
                  </button>
                  <button
                    type="button"
                    class="action-btn action-btn--writeoff"
                    :disabled="!r.payload.code"
                    :title="r.payload.code ? t('search.writeoff_title', { title: r.payload.title }) : t('search.no_code')"
                    :aria-label="t('options_page.mode_writeoff')"
                    @click="goWriteoff(r)"
                  >
                    <svg
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
                  </button>
                </template>
              </div>
            </td>
            </tr>
            <tr v-if="resultChains[keyFor(r)]?.length" class="result-chain-row">
              <td colspan="5">
                <LocationChain :chain="resultChains[keyFor(r)]" />
              </td>
            </tr>
          </tbody>
        </template>
      </table>

      <TablePagination :page="page" :last-page="lastPage" @go="goToPage" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { FulltextSearchResult } from '~/repository/modules/code'
import type { ChainCrumb } from '~/composables/useLocationChain'

const { t } = useI18n()
const { $api } = useNuxtApp()
const { chainForStore } = useLocationChain()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

const query = ref((route.query.q as string) || '')
const loading = ref(true)
const error = ref<string | null>(null)
const results = ref<FulltextSearchResult[]>([])
const selectedItems = ref<Set<number>>(new Set())
const selectedStores = ref<Set<number>>(new Set())
const itemsInLists = ref<Set<number>>(new Set())
const storesInLists = ref<Set<number>>(new Set())

const resultChains = ref<Record<string, ChainCrumb[]>>({})

// Поиск отдаёт все совпадения разом — одним запросом сразу по предметам и
// хранилищам, и постранично делить его на сервере не выйдет, не разрезав
// запрос на части. Поэтому постраничный вывод считается здесь, на том же
// списке, что пришёл: колонка и пагинация у всех таблиц одни и те же.
const PER_PAGE = 10
const page = ref(1)
const lastPage = computed(() => Math.max(1, Math.ceil(results.value.length / PER_PAGE)))
const pageResults = computed(() =>
  results.value.slice((page.value - 1) * PER_PAGE, page.value * PER_PAGE)
)

function goToPage(to: number) {
  const target = Math.min(Math.max(1, to), lastPage.value)
  router.push({ query: { ...route.query, page: target } })
}

// Как и в списке хранилищ, номер страницы берётся из адресной строки, причём
// не только по смене адреса, но и при загрузке: при прямом заходе на ?page=2
// подписка молчала, и список открывался на первой странице.
function syncPage() {
  page.value = Math.min(Math.max(1, Number(route.query.page) || 1), lastPage.value)
}

function keyFor(r: FulltextSearchResult): string {
  return `${r.type}-${r.payload.id}`
}

const selectedItemIds = computed(() => [...selectedItems.value])
const selectedStoreIds = computed(() => [...selectedStores.value])
const someSelected = computed(() => selectedItems.value.size > 0 || selectedStores.value.size > 0)
// «Выделить все» отмечает то, что видно на странице, а не все совпадения
// сразу: иначе на второй странице нажатая галочка отмечала бы строки, которых
// на экране нет. Так же ведёт себя список предметов, где сервер отдаёт только
// текущую страницу.
const allSelected = computed(() => pageResults.value.length > 0 && pageResults.value.every(r => isSelected(r)))

function canEdit(r: FulltextSearchResult): boolean {
  return r.payload.rights?.includes('edit') ?? false
}

function isSelected(r: FulltextSearchResult): boolean {
  if (r.type === 'item') return selectedItems.value.has(r.payload.id)
  return selectedStores.value.has(r.payload.id)
}

function isInList(r: FulltextSearchResult): boolean {
  if (r.type === 'item') return itemsInLists.value.has(r.payload.id)
  return storesInLists.value.has(r.payload.id)
}

function toggleAll() {
  if (allSelected.value) {
    selectedItems.value = new Set()
    selectedStores.value = new Set()
  } else {
    const itemIds = new Set<number>()
    const storeIds = new Set<number>()
    for (const r of pageResults.value) {
      if (r.type === 'item') itemIds.add(r.payload.id)
      else storeIds.add(r.payload.id)
    }
    selectedItems.value = itemIds
    selectedStores.value = storeIds
  }
}

function toggleOne(r: FulltextSearchResult) {
  if (r.type === 'item') {
    const next = new Set(selectedItems.value)
    if (next.has(r.payload.id)) next.delete(r.payload.id)
    else next.add(r.payload.id)
    selectedItems.value = next
  } else {
    const next = new Set(selectedStores.value)
    if (next.has(r.payload.id)) next.delete(r.payload.id)
    else next.add(r.payload.id)
    selectedStores.value = next
  }
}

function clearSelection() {
  selectedItems.value = new Set()
  selectedStores.value = new Set()
  loadLabelListInfo()
}

function onTogglerChanged(e: { itemId?: number; storeId?: number; added: boolean }) {
  if (e.itemId) {
    const next = new Set(itemsInLists.value)
    if (e.added) next.add(e.itemId)
    else next.delete(e.itemId)
    itemsInLists.value = next
  }
  if (e.storeId) {
    const next = new Set(storesInLists.value)
    if (e.added) next.add(e.storeId)
    else next.delete(e.storeId)
    storesInLists.value = next
  }
}

// Переходим на главную в режиме «Пополнить/Списать», передавая код штрих-кода
// через ?scan= (как при сканировании) и режим через ?mode=.
function goReplenish(r: FulltextSearchResult) {
  if (!r.payload.code) return
  navigateOperation(r.payload.code, 'replenish')
}

function goWriteoff(r: FulltextSearchResult) {
  if (!r.payload.code) return
  navigateOperation(r.payload.code, 'writeoff')
}

function navigateOperation(code: string, mode: 'replenish' | 'writeoff') {
  void router.push({ path: '/', query: { scan: code, mode } })
}

/**
 * Введён ли в поиск код — буквально, символ в символ.
 *
 * Код набирают руками чаще, чем кажется: принтер этикеток отдал лист, код
 * сгорел, наклейка переехала с ящика на ящик. Искать его в общем поиске —
 * путь: он не название, не артикул и не производитель, и в выдаче он
 * терялся среди предметов «похожих». Теперь такой ввод идёт тем же путём,
 * что и сканирование, — на главную с кодом, где сценарий уже есть целиком:
 * предмет найден, код не найден, код без привязки.
 *
 * Проверка идёт тем же запросом, что и у сканера, и «найдено» считается
 * строго: ответ с предметом или хранилищем и без вариантов. Код без
 * привязки и код, подходящий под несколько предметов, — это уже не
 * однозначное совпадение, и обычный поиск полезнее.
 */
async function isExactCode(q: string): Promise<boolean> {
  try {
    const result = await $api.code.search(q)

    return 'payload' in result && result.payload !== null
  } catch {
    // Код не найден или сеть отвалилась — ищем как обычный текст.
    return false
  }
}

async function search() {
  const q = route.query.q as string
  if (!q) {
    error.value = t('search.no_query')
    loading.value = false
    return
  }

  // Пока идёт проверка кода, показываем тот же индикатор, что и при поиске:
  // запрос уходит в сеть, и пустой экран читался бы как зависшая страница.
  loading.value = true

  if (await isExactCode(q)) {
    loading.value = false
    void router.push({ path: '/', query: { scan: q } })

    return
  }

  const previousQuery = query.value
  query.value = q
  loading.value = true
  error.value = null
  results.value = []
  try {
    results.value = await $api.code.fulltextSearch(q)
    if (previousQuery !== q) {
      // Другой запрос — всегда с первой страницы: номер из адресной строки
      // относился к прошлому результату, где строк могло быть больше.
      page.value = 1
      if (route.query.page !== undefined) {
        router.replace({ query: { ...route.query, page: undefined } })
      }
    } else {
      // Тот же запрос, пришли по ссылке или кнопкой «назад» — держим страницу.
      syncPage()
    }
    selectedItems.value = new Set()
    selectedStores.value = new Set()
    await Promise.all([loadChains(), loadLabelListInfo()])
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || t('search.failed')
  } finally {
    loading.value = false
  }
}

async function loadChains() {
  const map: Record<string, ChainCrumb[]> = {}
  for (const r of results.value) {
    if (r.type === 'item') {
      map[keyFor(r)] = await chainForStore(r.payload.store_id)
    } else {
      map[keyFor(r)] = await chainForStore(r.payload.id, false)
    }
  }
  resultChains.value = map
}

async function loadLabelListInfo() {
  try {
    const lists = await $api.labelList.all()
    const itemIds = new Set<number>()
    const storeIds = new Set<number>()
    for (const list of lists) {
      for (const item of list.items ?? []) {
        itemIds.add(item.payload.id)
      }
      for (const store of list.stores ?? []) {
        storeIds.add(store.id)
      }
    }
    itemsInLists.value = itemIds
    storesInLists.value = storeIds
  } catch {
    // silently ignore
  }
}

const { trigger } = useSearchTrigger()

onMounted(search)

watch(() => route.query.q, () => {
  search()
})

watch(() => route.query.page, syncPage)

watch(trigger, () => {
  search()
})
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.loading,
.error,
.empty {
  padding: 20px;
  color: var(--text-muted);
}

.loading {
  position: relative;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading-text {
  font-size: 15px;
  color: var(--text-muted);
}

/* Ширина колонки с картинкой — в template.sass, колонка нужна не только здесь. */

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.empty {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  text-align: center;
  font-size: 15px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
}

.results-table th,
.results-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.results-table th:first-child,
.results-table td:first-child,
.results-table th:last-child,
.results-table td:last-child {
  width: 1px;
  white-space: nowrap;
}

.results-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.results-table td {
  color: var(--text-secondary);
}

.results-table .result-group:hover td {
  background: var(--bg-elevated);
}

.cb-col {
  width: 1px;
  white-space: nowrap;
  padding-right: 0;
}

.cb-col input[type="checkbox"] {
  accent-color: var(--accent);
  cursor: pointer;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

/* Рамка плашки — своего цвета, а не акцентная: плашка зелёная, и рамка
   акцентом читалась как отдельное предупреждение. Так же окрашены метки
   предметов в карточке. */
.type-item {
  background: var(--success-bg);
  color: var(--success-ink);
  border: 1px solid var(--success);
}

.type-store {
  background: var(--info-bg);
  color: var(--info);
  border: 1px solid var(--info-bg);
}

.result-title {
  font-size: 15px;
  color: var(--text);
}

.result-sub {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 2px;
}

.result-chain-row td {
  padding: 4px 12px 10px;
  background: var(--bg);
  border-top: 0;
  border-bottom: 1px solid var(--border);
  color: var(--text-dim);
}

.result-chain-row td::before {
  display: none;
}

.results-table tr:has(+ tr.result-chain-row) td {
  border-bottom: 0;
}

.actions {
  white-space: nowrap;
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 4px;
  align-items: center;
  justify-items: center;
}

.action-link,
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--link);
  text-decoration: none;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.action-btn {
  font-size: 0;
}

.action-link img.action-icon {
  width: 32px;
  height: 32px;
  display: block;
}

.action-btn svg {
  width: 32px;
  height: 32px;
}

.action-link:hover,
.action-btn:hover:not(:disabled) {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  color: var(--link-hover);
}

/* Пополнение помечено зелёным, как и режим «Пополнить» на главной: рамка
   акцентного цвета выглядела выделением, будто это другое действие. */
.action-btn--replenish {
  border-color: var(--success-bg);
  color: var(--success);
}

.action-btn--replenish:hover:not(:disabled) {
  border-color: var(--success);
  color: var(--success-hover);
  background: var(--success-bg);
}

.action-btn--writeoff {
  border-color: var(--warn-bg);
  color: var(--warn);
}

.action-btn--writeoff:hover:not(:disabled) {
  border-color: var(--warn);
  color: var(--warn-ink);
  background: var(--warn-bg);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.action-view {
  color: var(--link);
}

.action-grid :deep(.toggler-btn) {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border);
}

.action-grid :deep(.toggler-icon) {
  width: 32px;
  height: 32px;
}

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .results-table,
  .results-table tbody,
  .results-table tr,
  .results-table td {
    display: block;
  }

  .results-table thead {
    display: none;
  }

  .results-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .results-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .results-table td.cb-col {
    position: absolute;
    top: 12px;
    left: 14px;
    width: auto;
    padding: 0;
  }

  .results-table td.img-col {
    width: auto;
    padding: 6px 0;
    display: flex;
    align-items: center;
  }

  .results-table td.img-col::before {
    display: none;
  }

  .results-table td.cb-col input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  .results-table td.actions {
    position: static;
    width: auto;
    padding: 10px 0 0;
    white-space: normal;
    display: flex;
    justify-content: flex-end;
  }

  .action-grid {
    gap: 6px;
  }

  .action-link,
  .action-btn,
  .action-grid :deep(.toggler-btn) {
    width: 48px;
    height: 48px;
  }

  .action-link img.action-icon,
  .action-btn svg,
  .action-grid :deep(.toggler-icon) {
    width: 36px;
    height: 36px;
  }

  .results-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .results-table .result-group:hover td {
    background: transparent;
  }

  .results-table tr:has(+ tr.result-chain-row) {
    margin-bottom: 0;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
  }

  .results-table tr.result-chain-row {
    margin-bottom: 14px;
    padding: 8px 14px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 0 0 10px 10px;
    box-shadow: none;
  }

  .results-table tr.result-chain-row td {
    padding: 0;
  }
}
</style>
