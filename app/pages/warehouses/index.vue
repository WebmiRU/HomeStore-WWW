<template>
  <div class="warehouses-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('warehouses.list') }}</h3>
      <NuxtLink to="/warehouses/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <IndexTable
      :rows="warehouses"
      :columns="columns"
      :loading="loading"
      :error="error"
      :empty-text="t('warehouses.no_warehouses')"
      :page="meta.current_page || 1"
      :last-page="meta.last_page"
      :open-to="(w) => `/warehouses/${w.id}`"
      @page="goToPage"
    >
      <template #cell-photo="{ row: w }">
        <ItemPhoto :images="w.images" :alt="w.title" :size="48" lightbox />
      </template>
      <template #cell-user="{ row: w }">
        <span
          v-if="w.user"
          class="owner-name"
          :class="isOwner(w.user) ? 'owner--me' : 'owner--other'"
        >{{ w.user.name }}</span>
        <span v-else>—</span>
      </template>
      <template #cell-created_at="{ row: w }">{{ formatDate(w.created_at) }}</template>
      <template #actions="{ row: w }">
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
      </template>
    </IndexTable>
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

const warehouses = ref<WarehouseResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

const showOwnerColumn = computed(() => warehouses.value.some(w => w.user && w.user.id))

const columns = computed(() => [
  { key: 'id', label: 'ID' },
  { key: 'photo', label: t('list_common.photo'), class: 'img-col' },
  { key: 'title', label: t('common.title') },
  { key: 'created_at', label: t('common.created') },
  ...(showOwnerColumn.value ? [{ key: 'user', label: t('common.owner') }] : []),
])

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

@media (max-width: 768px) {
  .page-header {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>
