<template>
  <div class="warehouses-page">
    <div class="page-header">
      <h3 class="page-title">Склады</h3>
      <NuxtLink to="/warehouses/create" class="btn-add">Добавить</NuxtLink>
    </div>

    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="warehouses-table" v-if="warehouses.length">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Создан</th>
            <th v-if="showOwnerColumn">Владелец</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in warehouses" :key="w.id">
            <td data-label="ID">{{ w.id }}</td>
            <td data-label="Название">{{ w.title }}</td>
            <td data-label="Создан">{{ formatDate(w.created_at) }}</td>
            <td v-if="showOwnerColumn" data-label="Владелец">
              <span
                v-if="w.user"
                class="owner-name"
                :class="isOwner(w.user) ? 'owner--me' : 'owner--other'"
              >{{ w.user.name }}</span>
              <span v-else>—</span>
            </td>
            <td class="actions">
              <NuxtLink
                v-if="canEdit(w)"
                :to="`/warehouses/${w.id}/edit`"
                class="action-link action-edit"
                title="Редактировать"
                aria-label="Редактировать"
              >
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <NuxtLink
                v-else
                :to="`/warehouses/${w.id}/edit`"
                class="action-link action-view"
                title="Открыть"
                aria-label="Открыть"
              >
                <img src="/img/icon/view.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a
                href="#"
                class="action-link action-del"
                :class="{ 'action-del--forbidden': !canDelete(w) }"
                :title="canDelete(w) ? 'Удалить' : 'Нельзя удалить'"
                :aria-label="canDelete(w) ? 'Удалить' : 'Нельзя удалить'"
                @click.prevent="deleteWarehouse(w)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">Нет складов</div>

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
import { formatApiError } from '~/composables/formatApiError'
import type { AccessRight } from '~/repository/modules/access'
import type { WarehouseResponse } from '~/repository/modules/warehouse'
import { useCurrentUser } from '~/composables/useCurrentUser'

const { $api, $notify } = useNuxtApp()
const { isOwner } = useCurrentUser()
const route = useRoute()
const router = useRouter()

const warehouses = ref<WarehouseResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

const showOwnerColumn = computed(() => warehouses.value.some(w => w.user && w.user.id))

const rightsOf = (w: WarehouseResponse): AccessRight[] => w.rights ?? []
const canEdit = (w: WarehouseResponse): boolean => rightsOf(w).includes('edit')
const canDelete = (w: WarehouseResponse): boolean => rightsOf(w).includes('delete')

async function loadWarehouses(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.warehouse.list(page)
    warehouses.value = result.data
    meta.value = {
      current_page: result.meta.current_page,
      last_page: result.meta.last_page,
    }
  } catch (err: any) {
    error.value = err?.data?.error || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { page } })
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

async function deleteWarehouse(w: WarehouseResponse) {
  if (!canDelete(w)) return
  if (!confirm(`Удалить склад «${w.title}»?`)) return
  try {
    await $api.warehouse.delete(w.id)
    $notify.add('Склад удалён', { type: 'success' })
    await loadWarehouses(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, 'Ошибка удаления'), { type: 'error', timer: 10 })
  }
}

onMounted(() => {
  const page = Number(route.query.page) || 1
  loadWarehouses(page)
})

watch(() => route.query.page, (newPage) => {
  const page = Number(newPage) || 1
  loadWarehouses(page)
})
</script>

<style scoped>
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

.warehouses-table {
  width: 100%;
  border-collapse: collapse;
}

.warehouses-table th,
.warehouses-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.warehouses-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.warehouses-table td {
  color: #ccc;
}

.warehouses-table tr:hover td {
  background: #252525;
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

.action-view {
  color: #88a;
}

.action-del--forbidden {
  color: #666;
  cursor: not-allowed;
}

.action-del--forbidden:hover {
  color: #666;
}

.action-del--forbidden .action-icon {
  filter: grayscale(1);
  opacity: 0.55;
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

  .warehouses-table,
  .warehouses-table tbody,
  .warehouses-table tr,
  .warehouses-table td {
    display: block;
  }

  .warehouses-table thead {
    display: none;
  }

  .warehouses-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .warehouses-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .warehouses-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .warehouses-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .warehouses-table tr:hover td {
    background: transparent;
  }
}
</style>
