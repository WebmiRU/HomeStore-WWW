<template>
  <div class="trash-page">
    <div class="page-header">
      <h3 class="page-title">Корзина</h3>
      <p class="page-hint">
        Удалённое здесь не пропало: записи лежат в базе и их можно вернуть.
        Окончательное удаление необратимо.
      </p>
    </div>

    <TabBar :tabs="tabs" class="trash-tabs" />

    <div class="trash-toolbar">
      <label class="trash-all">
        <input
          type="checkbox"
          :checked="allSelected"
          :indeterminate.prop="someSelected && !allSelected"
          @change="toggleAll"
        />
        Выделить все
      </label>

      <span class="trash-count">Выбрано: {{ selected.size }}</span>

      <div class="trash-actions">
        <button type="button" class="btn-restore" :disabled="!selected.size || busy" @click="restoreSelected">
          Восстановить
        </button>
        <button
          v-if="canPurge"
          type="button"
          class="btn-purge"
          :disabled="!selected.size || busy"
          @click="purgeSelected"
        >
          Удалить совсем
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table v-if="entries.length" class="trash-table">
        <thead>
          <tr>
            <th class="cb-col"></th>
            <th>Название</th>
            <th>Удалён</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in entries" :key="e.id">
            <td class="cb-col">
              <input type="checkbox" :checked="selected.has(e.id)" @change="toggleOne(e.id)" />
            </td>
            <td data-label="Название">{{ e.title }}</td>
            <td data-label="Удалён">{{ e.deleted_date ?? '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Здесь пусто</div>

      <div v-if="meta.last_page > 1" class="pagination">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          class="page-btn"
          @click="goToPage((meta.current_page || 1) - 1)"
        >
          ← Назад
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }} · всего {{ meta.total }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          class="page-btn"
          @click="goToPage((meta.current_page || 1) + 1)"
        >
          Вперёд →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { formatApiError } from '~/composables/formatApiError'
import type { TrashEntry } from '~/repository/modules/trash'

const { $api, $notify } = useNuxtApp()
const route = useRoute()
const router = useRouter()

/**
 * Разделы корзины. Ключ — часть адреса, он же приходит на сервер в
 * /trash/{section}, поэтому переименование здесь ломает ссылки вида
 * «восстановить по прямой адрес».
 */
const sections = [
  { key: 'warehouse', label: 'Склады' },
  { key: 'store', label: 'Хранилища' },
  { key: 'item', label: 'Предметы' },
  { key: 'category', label: 'Категории' },
  { key: 'vendor', label: 'Производители' },
  { key: 'unit', label: 'Ед. изм.' },
  { key: 'property', label: 'Свойства' },
  { key: 'property-group', label: 'Группы свойств' },
  { key: 'dictionary', label: 'Справочники' },
  { key: 'dictionary-value', label: 'Значения справочников' },
  { key: 'label-preset', label: 'Шаблоны' },
  { key: 'label-list', label: 'Списки этикеток' },
  { key: 'user', label: 'Пользователи' },
]

const counts = ref<Record<string, number>>({})

/**
 * Подписи вкладок со счётчиками: «Предметы (3)».
 *
 * Число показывается только когда оно больше нуля, иначе вкладки
 * «Склады (0)», «Предметы (0)» и так далее превращаются в шум из
 * тринадцати нулей и взгляд цепляется не туда.
 */
const tabs = computed(() =>
  sections.map((section) => {
    const count = counts.value[section.key] ?? 0

    return { key: section.key, label: count > 0 ? `${section.label} (${count})` : section.label }
  }),
)

const activeSection = computed(() => {
  const q = route.query.tab
  return typeof q === 'string' && sections.some((s) => s.key === q) ? q : 'warehouse'
})

const entries = ref<TrashEntry[]>([])
const selected = ref<Set<number>>(new Set())
const loading = ref(true)
const error = ref<string | null>(null)
const busy = ref(false)
const canPurge = ref(true)
const meta = ref<{ current_page: number; last_page: number; total: number }>({
  current_page: 0,
  last_page: 0,
  total: 0,
})

const allSelected = computed(
  () => entries.value.length > 0 && entries.value.every((e) => selected.value.has(e.id)),
)
const someSelected = computed(() => entries.value.some((e) => selected.value.has(e.id)))

async function load(page?: number) {
  loading.value = true
  error.value = null
  try {
    // Счётчики обновляем на каждой загрузке: они меняются после
    // восстановления, удаления и перехода на другую вкладку.
    counts.value = await $api.trash.counts()

    const result = await $api.trash.list(activeSection.value, page)
    entries.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
      total: result.meta.total,
    }
    canPurge.value = result.can_purge !== false
    // Выделение с прошлой вкладки или страницы не имеет смысла: номера
    // записей там другие, и «удалить совсем» ушло бы не туда.
    selected.value = new Set()
  } catch (err: any) {
    error.value = formatApiError(err, 'Ошибка загрузки корзины')
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
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

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(entries.value.map((e) => e.id))
}

async function restoreSelected() {
  const ids = [...selected.value]
  if (ids.length === 0) return

  busy.value = true
  try {
    const result = await $api.trash.restore(activeSection.value, ids)
    const refused = Object.keys(result.failed ?? {})

    if (result.restored > 0) {
      $notify.add(
        refused.length > 0
          ? `Восстановлено: ${result.restored}, не восстановлено: ${refused.length}`
          : `Восстановлено: ${result.restored}`,
        { type: 'success' },
      )
    }

    if (refused.length > 0) {
      // Причины показываем списком: иначе непонятно, что делать дальше —
      // молчаливый отказ читается как «ничего не произошло».
      $notify.add(
        `Не восстановлено: ${refused.map((title) => `${title} — ${result.failed[title]}`).join('; ')}`,
        { type: 'error', timer: 15 },
      )
    }

    await load(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка восстановления'), { type: 'error', timer: 10 })
  } finally {
    busy.value = false
  }
}

async function purgeSelected() {
  const ids = [...selected.value]
  if (ids.length === 0) return

  // Явное подтверждение с числом: восстановить потом будет нечего, а из
  // каскадов выживают не все — удаление хранилища уносит вложенные.
  if (!confirm(`Удалить выбранные (${ids.length}) совсем, безвозвратно?`)) return

  busy.value = true
  try {
    const result = await $api.trash.purge(activeSection.value, ids)

    $notify.add(`Удалено совсем: ${result.purged}`, { type: 'success' })
    await load(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  } finally {
    busy.value = false
  }
}

onMounted(() => load(Number(route.query.page) || 1))

watch(
  () => [route.query.tab, route.query.page],
  () => load(Number(route.query.page) || 1),
)
</script>

<style scoped>
.page-header {
  margin-bottom: 12px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 18px;
  color: #ccc;
}

.page-hint {
  margin: 0;
  font-size: 13px;
  color: #888;
}

.trash-tabs {
  margin: 14px 0 16px;
}

.trash-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.trash-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #aaa;
  cursor: pointer;
}

.trash-count {
  font-size: 13px;
  color: #888;
}

.trash-actions {
  display: flex;
  gap: 10px;
  margin-left: auto;
}

.btn-restore,
.btn-purge {
  padding: 7px 16px;
  font-size: 13px;
  font-family: inherit;
  border-radius: 4px;
  cursor: pointer;
}

.btn-restore {
  color: #9fd8a6;
  background: #1f3a24;
  border: 1px solid #3a7a3a;
}

.btn-restore:hover:not(:disabled) {
  background: #2a4a2f;
}

.btn-purge {
  color: #f0a8a8;
  background: #3a1f1f;
  border: 1px solid #7a3a3a;
}

.btn-purge:hover:not(:disabled) {
  background: #4d2a2a;
}

.btn-restore:disabled,
.btn-purge:disabled {
  opacity: 0.5;
  cursor: default;
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

.trash-table {
  width: 100%;
  border-collapse: collapse;
}

.trash-table th,
.trash-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.trash-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.trash-table td {
  color: #ccc;
}

.cb-col {
  width: 1px;
  white-space: nowrap;
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
  .trash-actions {
    margin-left: 0;
    flex-wrap: wrap;
  }

  .trash-table,
  .trash-table tbody,
  .trash-table tr,
  .trash-table td {
    display: block;
  }

  .trash-table thead {
    display: none;
  }

  .trash-table tr {
    position: relative;
    margin-bottom: 12px;
    padding: 34px 14px 12px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
  }

  .trash-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 0;
    border-bottom: 0;
  }

  .trash-table td.cb-col {
    position: absolute;
    top: 10px;
    left: 12px;
    width: auto;
  }

  .trash-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 2px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }
}
</style>
