<template>
  <div class="items-page">
    <div class="page-header">
      <h3 class="page-title">Список предметов</h3>
      <div class="page-header-actions">
        <MassLabelListButton
          :item-ids="selectedIds"
          :store-ids="[]"
          @done="clearSelection"
        />
        <NuxtLink to="/items/create" class="btn-add">Добавить</NuxtLink>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>

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
            <th>Название</th>
            <th>Хранилище</th>
            <th>Количество</th>
            <th>Создан</th>
            <th>Обновлён</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.payload.id">
            <td class="cb-col">
              <input
                type="checkbox"
                :checked="selected.has(item.payload.id)"
                @change="toggleOne(item.payload.id)"
              />
            </td>
            <td data-label="ID">{{ item.payload.id }}</td>
            <td data-label="Название">{{ item.payload.title }}</td>
            <td data-label="Хранилище">{{ item.store?.[0]?.title ?? '—' }}</td>
            <td data-label="Кол-во">{{ item.payload.quantity ?? '—' }}</td>
            <td data-label="Создан">{{ formatDate(item.payload.created_at) }}</td>
            <td data-label="Обновлён">{{ formatDate(item.payload.updated_at) }}</td>
            <td class="actions">
              <LabelListToggler :item-id="item.payload.id" :in-any-list="itemsInLists.has(item.payload.id)" @changed="onTogglerChanged" />
              <NuxtLink :to="`/items/${item.payload.id}/edit`" class="action-link action-edit" title="Редактировать" aria-label="Редактировать">
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a href="#" class="action-link action-del" title="Удалить" aria-label="Удалить" @click.prevent="deleteItem(item.payload.id)">
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет предметов</div>

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          Вперёд →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { ItemResponse } from '~/repository/modules/item'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

const items = ref<ItemResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })
const selected = ref<Set<number>>(new Set())
const itemsInLists = ref<Set<number>>(new Set())

const selectedIds = computed(() => [...selected.value])
const someSelected = computed(() => selected.value.size > 0)
const allSelected = computed(() => items.value.length > 0 && items.value.every(i => selected.value.has(i.payload.id)))

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
    const result = await $api.item.list(page)
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
  router.push({ query: { page } })
}

async function deleteItem(id: number) {
  if (!confirm('Удалить предмет?')) return
  try {
    await $api.item.delete(id)
    $notify.add('Предмет удалён', { type: 'success' })
    await loadItems(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadItems(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadItems(page)
})
</script>

<style scoped>
.items-page {
  /* */
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-title {
  margin: 0;
  font-size: 18px;
  color: #ccc;
}

.page-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-add {
  padding: 6px 16px;
  font-size: 14px;
  background: #2a5a2a;
  color: #cfc;
  border: 1px solid #3a7a3a;
  border-radius: 4px;
  text-decoration: none;
  cursor: pointer;
}

.btn-add:hover {
  background: #3a7a3a;
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

.items-table {
  width: 100%;
  border-collapse: collapse;
}

.items-table th,
.items-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.items-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.items-table td {
  color: #ccc;
}

.items-table tr:hover td {
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

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
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
  color: #aaf;
}

.action-del {
  color: #a66;
}

.action-del:hover {
  color: #f88;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.page-btn {
  padding: 6px 14px;
  font-size: 13px;
  background: #333;
  color: #ccc;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: #444;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: #888;
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
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .items-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
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

  .items-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .items-table tr:hover td {
    background: transparent;
  }
}
</style>
