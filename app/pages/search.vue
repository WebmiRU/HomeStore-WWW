<template>
  <div class="search-page">
    <div class="page-header">
      <h3 class="page-title">Результаты поиска: «{{ query }}»</h3>
      <MassLabelListButton
        :item-ids="selectedItemIds"
        :store-ids="selectedStoreIds"
        @done="clearSelection"
      />
    </div>

    <div v-if="loading" class="loading">Поиск...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <div v-if="results.length === 0" class="empty">Ничего не найдено</div>

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
            <th>Тип</th>
            <th>Название</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in results" :key="`${r.type}-${r.payload.id}`">
            <td class="cb-col">
              <input
                type="checkbox"
                :checked="isSelected(r)"
                @change="toggleOne(r)"
              />
            </td>
            <td>
              <span v-if="r.type === 'item'" class="type-badge type-item">Предмет</span>
              <span v-else class="type-badge type-store">Хранилище</span>
            </td>
            <td>
              <div class="result-title">{{ r.payload.title }}</div>
              <div v-if="r.payload.title_print" class="result-sub">{{ r.payload.title_print }}</div>
            </td>
            <td class="actions">
              <LabelListToggler
                v-if="r.type === 'item'"
                :item-id="r.payload.id"
                :in-any-list="itemsInLists.has(r.payload.id)"
              />
              <LabelListToggler
                v-else
                :store-id="r.payload.id"
                :in-any-list="storesInLists.has(r.payload.id)"
              />
              <NuxtLink
                v-if="r.type === 'item'"
                :to="`/items/${r.payload.id}/edit`"
                class="action-link"
              >
                ред.
              </NuxtLink>
              <NuxtLink
                v-else
                :to="`/stores/${r.payload.id}/edit`"
                class="action-link"
              >
                ред.
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { FulltextSearchResult } from '~/repository/modules/code'

const { $api } = useNuxtApp()
const route = useRoute()

const query = ref((route.query.q as string) || '')
const loading = ref(true)
const error = ref<string | null>(null)
const results = ref<FulltextSearchResult[]>([])
const selectedItems = ref<Set<number>>(new Set())
const selectedStores = ref<Set<number>>(new Set())
const itemsInLists = ref<Set<number>>(new Set())
const storesInLists = ref<Set<number>>(new Set())

const selectedItemIds = computed(() => [...selectedItems.value])
const selectedStoreIds = computed(() => [...selectedStores.value])
const someSelected = computed(() => selectedItems.value.size > 0 || selectedStores.value.size > 0)
const allSelected = computed(() => results.value.length > 0 && results.value.every(r => isSelected(r)))

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
    for (const r of results.value) {
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
}

async function search() {
  const q = route.query.q as string
  if (!q) {
    error.value = 'Не указан поисковый запрос'
    loading.value = false
    return
  }

  query.value = q
  loading.value = true
  error.value = null
  try {
    results.value = await $api.code.fulltextSearch(q)
    selectedItems.value = new Set()
    selectedStores.value = new Set()
    await loadLabelListInfo()
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || 'Ошибка поиска'
  } finally {
    loading.value = false
  }
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

onMounted(search)

watch(() => route.query.q, () => {
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
  color: #ccc;
}

.loading,
.error,
.empty {
  padding: 20px;
  color: #888;
}

.error {
  color: #f88;
  background: #3a1a1a;
  border-radius: 4px;
}

.empty {
  background: #222;
  border: 1px solid #333;
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
  border-bottom: 1px solid #333;
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
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.results-table td {
  color: #ccc;
}

.results-table tr:hover td {
  background: #252525;
}

.cb-col {
  width: 1px;
  white-space: nowrap;
  padding-right: 0;
}

.cb-col input[type="checkbox"] {
  accent-color: #3a7a3a;
  cursor: pointer;
}

.type-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
  font-weight: 600;
}

.type-item {
  background: #2a3a2a;
  color: #8c8;
  border: 1px solid #3a5a3a;
}

.type-store {
  background: #2a2a3a;
  color: #88c;
  border: 1px solid #3a3a5a;
}

.result-title {
  font-size: 15px;
  color: #ddd;
}

.result-sub {
  font-size: 13px;
  color: #888;
  margin-top: 2px;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  font-size: 13px;
}

.action-link:hover {
  color: #aaf;
}
</style>
