<template>
  <div class="items-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('items.list') }}</h3>
      <div class="page-header-actions">
        <MassLabelListButton
          :item-ids="selectedIds"
          :store-ids="[]"
          @done="clearSelection"
        />
        <!--
          Фильтры свёрнуты, а кнопка живёт рядом с «Добавить».
          --
          Развёрнутая панель занимала 75px над таблицей на каждой странице
          списка, и на ноутбуке выдавала список из десяти строк с кнопками
          пагинации за нижним краем экрана: половина списка и «вперёд/назад» —
          внизу, а отбор — наверху, и прокрутка туда-обратно ради одного
          переключателя. Свернутая панель занимает одну кнопку, а когда
          фильтры заданы, кнопка показывает, что они заданы, и панель
          подсвечивается.
        -->
        <button
          type="button"
          class="btn-add btn-filters"
          :class="{ 'btn-filters--on': filtersOpen || hasActiveFilters }"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          <img src="/img/icon/filter.svg" class="btn-filters-icon" alt="" />
          {{ t('items.filters') }}
        </button>
        <NuxtLink to="/items/create" class="btn-add">{{ t('items.add') }}</NuxtLink>
      </div>
    </div>

    <div v-if="filtersOpen" class="filter-bar">
      <!--
        Подсказка про вложенные категории стоит под своим селектом, а не в
        конце панели: у производителя вложенности нет, и рядом с ним такая
        надпись читалась как относящаяся к нему.
      -->
      <label class="filter">
        <span class="filter-label">{{ t('items.category') }}</span>
        <select :value="categoryFilter" class="filter-select" @change="onCategoryChange">
          <option :value="null">{{ t('placeholders.all') }}</option>
          <option v-for="option in categoryOptions" :key="option.id" :value="option.id">
            {{ '—'.repeat(option.depth) }}{{ option.depth > 0 ? ' ' : '' }}{{ option.title }}
          </option>
        </select>
        <span class="filter-hint">{{ t('categories.with_nested') }}</span>
      </label>

      <label class="filter">
        <span class="filter-label">{{ t('items.vendor') }}</span>
        <select :value="vendorFilter" class="filter-select" @change="onVendorChange">
          <option :value="null">{{ t('placeholders.all') }}</option>
          <option v-for="option in vendors" :key="option.id" :value="option.id">
            {{ option.title }}
          </option>
        </select>
      </label>

      <span class="filter-reset-wrap">
        <a v-if="categoryFilter || vendorFilter" href="#" class="filter-reset" @click.prevent="resetFilters">{{ t('common.reset') }}</a>
      </span>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="items-table" v-if="items.length">
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
            <th>ID</th>
            <!--
              «Фото», а не «Изображение», как в выдаче поиска: колонок здесь больше
              десяти, и слово из одиннадцати букв отдавало картинке вдвое больше
              места, чем она занимает, — колонка выходила 94px против 42px самой
              картинки, а «Название» сжималось до 169px.
            -->
            <th class="img-col">{{ t('items.image') }}</th>
            <th>{{ t('items.title') }}</th>
            <th>{{ t('items.vendor') }}</th>
            <th>{{ t('items.category') }}</th>
            <th>{{ t('items.store') }}</th>
            <th>{{ t('items.quantity') }}</th>
            <th>{{ t('common.created') }}</th>
            <th>{{ t('common.updated') }}</th>
            <th v-if="showOwnerColumn">{{ t('common.owner') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.payload.id" @dblclick="openRow($event, `/items/${item.payload.id}`)">
            <td class="cb-col">
              <input
                type="checkbox"
                :checked="selected.has(item.payload.id)"
                @change="toggleOne(item.payload.id)"
              />
            </td>
            <td data-label="ID">{{ item.payload.id }}</td>
            <td class="img-col">
              <ItemPhoto :images="item.images" :alt="item.payload.title" :size="38" lightbox />
            </td>
            <td :data-label="t('items.title')">{{ item.payload.title }}</td>
            <td :data-label="t('items.vendor')">
              <NuxtLink v-if="item.vendor && !item.vendor.deleted" :to="`/vendors/${item.vendor.id}`" class="row-link">
                {{ item.vendor.title }}
              </NuxtLink>
              <span v-else-if="item.vendor" class="muted">{{ item.vendor.title }} {{ t('placeholders.deleted') }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td :data-label="t('items.category')">
              <NuxtLink v-if="item.category && !item.category.deleted" :to="`/categories/${item.category.id}`" class="row-link">
                {{ item.category.title }}
              </NuxtLink>
              <span v-else-if="item.category" class="muted">{{ item.category.title }} {{ t('placeholders.deleted') }}</span>
              <span v-else class="muted">—</span>
            </td>
            <td :data-label="t('items.store')">
              <!-- Ссылка на карточку хранилища, как у категории и производителя.
                   В цепочке store первым идёт само хранилище, дальше — предки.
                   У удалённого ссылки нет: переход вёл бы в 404, поэтому
                  название остаётся текстом с пометкой. -->
              <NuxtLink v-if="item.store?.[0] && !item.store[0].deleted" :to="`/stores/${item.store[0].id}`" class="row-link">
                {{ item.store[0].title }}
              </NuxtLink>
              <span v-else-if="item.store?.[0]" class="muted">{{ item.store[0].title }} {{ t('placeholders.deleted') }}</span>
              <span v-else class="muted">—</span>
            </td>
            <!--
              У расходуемого предмета одного числа мало: «2» ничего не говорит о
              том, сколько на самом деле осталось, — расход идёт по свойствам, и
              штука может быть неполной. Поэтому штуки и запас рядом: «2 шт
              (1800 мл)». Единицы в таблице нет, а названия свойств и так в
              колонке «Свойства» этой же строки.
            -->
            <td :data-label="t('items.quantity_short')">
              <template v-if="item.partial && item.partial.length">
                <span class="qty-main">{{ item.payload.quantity ?? '—' }} {{ t('items.pieces_word') }}</span>
                <span
                  class="qty-partial"
                  :title="item.partial
                    .map((p) => `${p.property_title}: ${formatAmount(p.total)} ${p.unit_full ?? p.unit_short ?? ''}`)
                    .join('; ')"
                >
                  ({{ item.partial.map((p) => `${formatAmount(p.total)} ${p.unit_short ?? ''}`.trim()).join(', ') }})
                </span>
              </template>
              <template v-else>{{ item.payload.quantity ?? '—' }}</template>
            </td>
            <td :data-label="t('common.created')">{{ formatDate(item.payload.created_at) }}</td>
            <td :data-label="t('common.updated')">{{ formatDate(item.payload.updated_at) }}</td>
            <td v-if="showOwnerColumn" :data-label="t('common.owner')">
              <span
                v-if="item.payload.user"
                class="owner-name"
                :class="isOwner(item.payload.user) ? 'owner--me' : 'owner--other'"
              >{{ item.payload.user.name }}</span>
              <span v-else>—</span>
            </td>
            <td class="actions">
              <LabelListToggler :item-id="item.payload.id" :in-any-list="itemsInLists.has(item.payload.id)" @changed="onTogglerChanged" />
              <NuxtLink
                v-if="canEdit(item)"
                :to="`/items/${item.payload.id}`"
                class="action-link action-edit"
                :title="t('common.edit')"
                :aria-label="t('common.edit')"
              >
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <NuxtLink
                v-else
                :to="`/items/${item.payload.id}`"
                class="action-link action-view"
                :title="t('common.open')"
                :aria-label="t('common.open')"
              >
                <img src="/img/icon/view.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a
                href="#"
                class="action-link action-del"
                :class="{ 'action-del--forbidden': !canDelete(item) }"
                :title="canDelete(item) ? t('common.delete') : t('items.delete_blocked')"
                :aria-label="canDelete(item) ? t('common.delete') : t('items.delete_blocked')"
                @click.prevent="deleteItem(item.payload.id)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ t('items.no_items') }}</div>

      <TablePagination
        :page="meta.current_page || 1"
        :last-page="meta.last_page"
        @go="goToPage"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatAmount } from '~/utils/amount'
import type { ItemResponse } from '~/repository/modules/item'
import type { CategoryResponse } from '~/repository/modules/category'
import type { VendorResponse } from '~/repository/modules/vendor'
import type { AccessRight } from '~/repository/modules/access'
import { useCurrentUser } from '~/composables/useCurrentUser'
import { categorySelectOptions } from '~/composables/categorySelectOptions'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const { isOwner } = useCurrentUser()
const { openRow } = useRowOpen()
const route = useRoute()
const router = useRouter()

const items = ref<ItemResponse[]>([])
const categories = ref<CategoryResponse[]>([])
const vendors = ref<VendorResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })
const selected = ref<Set<number>>(new Set())
const itemsInLists = ref<Set<number>>(new Set())

/** Фильтр живёт в адресе: ссылку на «предметы категории» можно переслать. */
const categoryFilter = computed<number | null>(() => {
  const value = Number(route.query.category_id)

  return Number.isFinite(value) && value > 0 ? value : null
})

const categoryOptions = computed(() => categorySelectOptions(categories.value))

/** Фильтр по производителю живёт в адресе — как и фильтр по категории. */
const vendorFilter = computed<number | null>(() => {
  const value = Number(route.query.vendor_id)

  return Number.isFinite(value) && value > 0 ? value : null
})

/**
 * Панель фильтров свёрнута.
 *
 * Открыта сразу только тогда, когда фильтр уже задан — пришли по ссылке
 * «предметы категории» и должны увидеть, что список отобран, иначе кнопка
 * молчала бы о чужом состоянии.
 */
const filtersOpen = ref(false)

watch(
  [categoryFilter, vendorFilter],
  ([category, vendor]) => {
    if (category || vendor) filtersOpen.value = true
  },
  { immediate: true },
)

const hasActiveFilters = computed(() => !!(categoryFilter.value || vendorFilter.value))

const selectedIds = computed(() => [...selected.value])
const someSelected = computed(() => selected.value.size > 0)
const allSelected = computed(() => items.value.length > 0 && items.value.every(i => selected.value.has(i.payload.id)))
const showOwnerColumn = computed(() => items.value.some(i => i.payload.user && i.payload.user.id))

const rightsOf = (item: ItemResponse): AccessRight[] => item.rights ?? []
const canEdit = (item: ItemResponse): boolean => rightsOf(item).includes('edit')
const canDelete = (item: ItemResponse): boolean => rightsOf(item).includes('delete')

function toggleAll() {
  if (allSelected.value) {
    selected.value = new Set()
  } else {
    selected.value = new Set(items.value.map(i => i.payload.id))
  }
}

function toggleOne(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selected.value = next
}

function clearSelection() {
  selected.value = new Set()
  loadLabelListInfo()
}

function onTogglerChanged(e: { itemId?: number; storeId?: number; added: boolean }) {
  if (e.itemId) {
    const next = new Set(itemsInLists.value)
    if (e.added) next.add(e.itemId)
    else next.delete(e.itemId)
    itemsInLists.value = next
  }
}

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

async function loadItems(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.item.list(page, categoryFilter.value, vendorFilter.value)
    items.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
    }
    selected.value = new Set()
    await loadLabelListInfo()
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

async function loadLabelListInfo() {
  try {
    const lists = await $api.labelList.all()
    const ids = new Set<number>()
    for (const list of lists) {
      for (const item of list.items ?? []) {
        ids.add(item.payload.id)
      }
    }
    itemsInLists.value = ids
  } catch {
    // silently ignore — indicator is optional
  }
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

function onCategoryChange(event: Event, value: number | null = null) {
  const raw = value !== null ? value : Number((event.target as HTMLSelectElement).value)
  const query = { ...route.query, page: undefined, category_id: raw > 0 ? raw : undefined }

  router.push({ query })
}

function onVendorChange(event: Event) {
  const raw = Number((event.target as HTMLSelectElement).value)
  const query = { ...route.query, page: undefined, vendor_id: raw > 0 ? raw : undefined }

  router.push({ query })
}

/** Сброс снимает оба фильтра разом: сбросили категорию — остался производитель. */
function resetFilters() {
  router.push({ query: { ...route.query, page: undefined, category_id: undefined, vendor_id: undefined } })
}

async function deleteItem(id: number) {
  const item = items.value.find(i => i.payload.id === id)
  if (item && !canDelete(item)) return
  if (!confirm(t('items.delete_confirm'))) return
  try {
    await $api.item.delete(id)
    $notify.add(t('items.delete_done'), { type: 'success' })
    await loadItems(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('items.delete_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(async () => {
  try {
    categories.value = await $api.category.all()
  } catch {
    // Список предметов отфильтровать нечем, но сам он показывается.
  }

  try {
    vendors.value = await $api.vendor.all()
  } catch {
    // Производители нужны только фильтру: без них список всё равно виден.
  }
  loadItems(Number(route.query.page) || 1)
})

watch(
  () => [route.query.page, route.query.category_id],
  () => loadItems(Number(route.query.page) || 1),
)
</script>

<style scoped>
.items-page {
  /* */
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: var(--text-secondary);
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * Панель фильтров: метка, селект и подсказка стоят столбиком внутри одного
 * фильтра, а сами фильтры — в строку.
 *
 * Раньше всё лежало в одну линию, и подсказка про вложенные категории
 * оказывалась между двумя селектами — и читалась как относящаяся ко второму.
 * Столбик вернул её под свой селект, где ей и место.
 */
.filter-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.filter {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.filter-label {
  font-size: 13px;
  color: var(--text-muted);
}

.filter-select {
  /* Ширина держится у обоих селектов: в столбике иначе он схлопывается до
     ширины самой длинной подписи, и панель прыгает при выборе. */
  width: 260px;
  max-width: 100%;
  padding: 6px 10px;
  font-size: 14px;
  font-family: inherit;
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  outline: none;
}

.filter-select:focus {
  border-color: var(--border-strong);
}

.filter-hint {
  font-size: 12px;
  color: var(--text-dim);
}

.filter-reset {
  color: var(--link);
  text-decoration: none;
  margin-left: 4px;
}

.filter-reset:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

.row-link {
  color: var(--link);
  text-decoration: none;
}

.row-link:hover {
  color: var(--link-hover);
  text-decoration: underline;
}

.muted {
  color: var(--text-faint);
}

/*
 * Остаток у расходуемого предмета — вторая строка под количеством, мельче и
 * приглушённее: главное в колонке число штук, а запас по свойствам его
 * уточняет. Отдельной строкой, а не в скобках в том же: у предмета с двумя
 * расходуемыми свойствами запись в скобках не помещалась в колонку и ломала
 * строку таблицы.
 */
.qty-partial {
  display: block;
  font-size: 12px;
  color: var(--text-faint);
  white-space: nowrap;
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: var(--accent-bg);
  color: var(--accent-ink);
  border: 1px solid var(--accent);
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
}

.btn-add:hover {
  background: var(--accent);
}

/*
 * Кнопка «Фильтры» — та же, что «Добавить», но спокойнее: она не ведёт
 * на новую карточку, а раскрывает панель на этой же странице, и заливать её
 * акцентом значило бы уравнять её по весу с главным действием.
 *
 * Отмеченная — заливка акцентом: фильтры заданы, и панель сейчас свёрнута.
 * Без отметки человек увидит отфильтрованный список и не поймёт, почему он
 * такой короткий.
 */
.btn-filters {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border-strong);
}

.btn-filters:hover {
  background: var(--bg-elevated);
  color: var(--text);
}

.btn-filters--on {
  background: var(--accent-bg);
  color: var(--accent-ink);
  border-color: var(--accent);
}

.btn-filters-icon {
  width: 14px;
  height: 14px;
  display: block;
  /* Иконка currentColor, но задать её здесь: сама по себе она в наследуемой
   * заливке кнопки оказалась бы того же акцентного тона на акцентном фоне и
   * пропала. */
  color: inherit;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: var(--text-muted);
}

.error {
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 4px;
}

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th,
.items-table td {
  /*
   * Вертикальный отступ 6px, а не 8px.
   *
   * Высоту строки задаёт фотография в 32px, и на 10 строках каждые два пикселя
   * — это 20px, которых не хватало кнопкам пагинации: список показан, а
   * перелистывать его приходилось прокруткой. По горизонтали 12px оставлены:
   * там они держат колонки, а высоты строки не касаются.
   */
  padding: 6px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.items-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.items-table td {
  color: var(--text-secondary);
}

.items-table tr:hover td {
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

.actions {
  white-space: nowrap;
}

.action-link {
  color: var(--link);
  text-decoration: none;
  margin-right: 8px;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.action-link img.action-icon {
  width: 18px;
  height: 18px;
  display: block;
}

.action-link:hover {
  color: var(--link-hover);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
}

.action-view {
  color: var(--link);
}

.action-del--forbidden {
  color: var(--text-faint);
  cursor: not-allowed;
}

.action-del--forbidden:hover {
  color: var(--text-faint);
}

.action-del--forbidden .action-icon {
  filter: grayscale(1);
  opacity: 0.55;
}



.page-btn:hover:not(:disabled) {
  background: var(--bg-hover);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}


@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }

  .items-table,
  .items-table tbody,
  .items-table tr,
  .items-table td {
    display: block;
  }

  .items-table thead {
    display: none;
  }

  .items-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .items-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .items-table td.cb-col {
    position: absolute;
    top: 12px;
    left: 14px;
    width: auto;
    padding: 0;
  }

  .items-table td.cb-col input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }

  .items-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  /* Картинка в узком экране встаёт в верхнюю полосу карточки рядом с
     галочкой, а не отдельной строкой с подписью «Изображение»: подпись над
     картинкой в тридцать пикселей читается как название, и строка получается
     вдвое выше карточки. Полоса под это и отведена — 44px, из них на картинку
     уходит 40. */
  .items-table td.img-col {
    position: absolute;
    top: 1px;
    left: 42px;
    width: auto;
    padding: 0;
  }

  .items-table td.img-col::before {
    display: none;
  }

  .items-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .items-table tr:hover td {
    background: transparent;
  }
}
</style>
