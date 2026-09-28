<template>
  <div class="warehouses-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('warehouses.list') }}</h3>
      <NuxtLink to="/warehouses/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table class="warehouses-table" v-if="warehouses.length">
        <thead>
          <tr>
            <th>ID</th>
            <th class="img-col">{{ t('list_common.photo') }}</th>
            <th>{{ t('common.title') }}</th>
            <th>{{ t('common.created') }}</th>
            <th v-if="showOwnerColumn">{{ t('common.owner') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in warehouses" :key="w.id" @dblclick="openRow($event, `/warehouses/${w.id}`)">
            <td data-label="ID">{{ w.id }}</td>
            <td class="img-col">
              <ItemPhoto :images="w.images" :alt="w.title" :size="38" lightbox />
            </td>
            <td :data-label="t('common.title')">{{ w.title }}</td>
            <td :data-label="t('common.created')">{{ formatDate(w.created_at) }}</td>
            <td v-if="showOwnerColumn" :data-label="t('common.owner')">
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
                :to="`/warehouses/${w.id}`"
                class="action-link action-edit"
                :title="t('common.edit')"
                :aria-label="t('common.edit')"
              >
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <NuxtLink
                v-else
                :to="`/warehouses/${w.id}`"
                class="action-link action-view"
                :title="t('common.open')"
                :aria-label="t('common.open')"
              >
                <img src="/img/icon/view.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a
                href="#"
                class="action-link action-del"
                :class="{ 'action-del--forbidden': !canDelete(w) }"
                :title="canDelete(w) ? t('common.delete') : t('list_common.delete_blocked')"
                :aria-label="canDelete(w) ? t('common.delete') : t('list_common.delete_blocked')"
                @click.prevent="deleteWarehouse(w)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ t('warehouses.no_warehouses') }}</div>

      <div class="pagination" v-if="meta.last_page > 1">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          @click="goToPage((meta.current_page || 1) - 1)"
          class="page-btn"
        >
          ← {{ t('common.back') }}
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          @click="goToPage((meta.current_page || 1) + 1)"
          class="page-btn"
        >
          {{ t('common.forward') }} →
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
const { t } = useI18n()
const { isOwner } = useCurrentUser()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

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
  if (!confirm(t('warehouses.delete_confirm', { title: w.title }))) return
  try {
    await $api.warehouse.delete(w.id)
    $notify.add(t('warehouses.delete_done'), { type: 'success' })
    await loadWarehouses(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
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
  color: var(--text-secondary);
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

.warehouses-table {
  width: 100%;
  border-collapse: collapse;
}

.warehouses-table th,
.warehouses-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.warehouses-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.warehouses-table td {
  color: var(--text-secondary);
}

.warehouses-table tr:hover td {
  background: var(--bg-elevated);
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
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  cursor: pointer;
}

.page-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bg-hover) 70%, var(--text));
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.page-info {
  font-size: 13px;
  color: var(--text-muted);
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
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .warehouses-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
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
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .warehouses-table tr:hover td {
    background: transparent;
  }
}
</style>
