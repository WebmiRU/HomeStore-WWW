<template>
  <div class="vendors-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('vendors.list') }}</h3>
      <NuxtLink to="/vendors/create" class="btn-add">{{ t('vendors.add') }}</NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('common.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table v-if="vendors.length" class="vendors-table">
        <thead>
          <tr>
            <th>{{ t('list_common.logo') }}</th>
            <th>{{ t('vendors.title') }}</th>
            <th>{{ t('list_common.description') }}</th>
            <th>{{ t('common.created') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in vendors"
            :key="m.id"
            @dblclick="openRow($event, `/vendors/${m.id}`)"
          >
            <td :data-label="t('list_common.logo')" class="cell-logo">
              <VendorLogo :logo-sha="m.logo_sha" :title="m.title" lightbox />
            </td>
            <td :data-label="t('vendors.title')">{{ m.title }}</td>
            <!-- Описание в списке обрезаем: в таблице ему место в одну строку,
                 а целиком оно живёт в карточке. -->
            <td :data-label="t('list_common.description')" class="cell-description">{{ m.description || '—' }}</td>
            <td :data-label="t('common.created')">{{ formatDate(m.created_at) }}</td>
            <td class="actions">
              <NuxtLink
                :to="`/vendors/${m.id}`"
                class="action-link action-edit"
                :title="t('common.edit')"
                :aria-label="t('common.edit')"
              >
                <img src="/img/icon/edit.svg" class="action-icon" alt="" />
              </NuxtLink>
              <a
                href="#"
                class="action-link action-del"
                :title="t('common.delete')"
                :aria-label="t('common.delete')"
                @click.prevent="deleteVendor(m)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ t('vendors.no_vendors') }}</div>

      <div v-if="meta.last_page > 1" class="pagination">
        <button
          :disabled="!meta.current_page || meta.current_page <= 1"
          class="page-btn"
          @click="goToPage((meta.current_page || 1) - 1)"
        >
          ← {{ t('common.back') }}
        </button>
        <span class="page-info">{{ meta.current_page }} / {{ meta.last_page }}</span>
        <button
          :disabled="!meta.current_page || meta.current_page >= meta.last_page"
          class="page-btn"
          @click="goToPage((meta.current_page || 1) + 1)"
        >
          {{ t('common.forward') }} →
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { formatDate } from '~/utils/auditLabels'
import { formatApiError } from '~/composables/formatApiError'
import type { VendorResponse } from '~/repository/modules/vendor'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

const vendors = ref<VendorResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

async function load(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.vendor.list(page)
    vendors.value = result.data
    meta.value = { current_page: result.meta.current_page, last_page: result.meta.last_page }
  } catch (err: any) {
    error.value = formatApiError(err, t('vendors.load_failed'))
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

async function deleteVendor(m: VendorResponse) {
  if (!confirm(t('list_common.delete_confirm', { title: m.title }))) return

  try {
    await $api.vendor.delete(m.id)
    $notify.add(t('vendors.delete_done'), { type: 'success' })
    await load(meta.value.current_page)
  } catch (err: any) {
    $notify.add(formatApiError(err, t('list_common.delete_failed')), { type: 'error', timer: 10 })
  }
}

onMounted(() => load(Number(route.query.page) || 1))

watch(
  () => route.query.page,
  (page) => load(Number(page) || 1),
)
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

.vendors-table {
  width: 100%;
  border-collapse: collapse;
}

.vendors-table th,
.vendors-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid #333;
  font-size: 14px;
}

.vendors-table th {
  color: #888;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.vendors-table td {
  color: #ccc;
}

.vendors-table tr:hover td {
  background: #252525;
}

.cell-logo {
  width: 1%;
  white-space: nowrap;
}

.cell-description {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: #88a;
  text-decoration: none;
  margin-right: 8px;
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

  .vendors-table,
  .vendors-table tbody,
  .vendors-table tr,
  .vendors-table td {
    display: block;
  }

  .vendors-table thead {
    display: none;
  }

  .vendors-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: #1e1e1e;
    border: 1px solid #2b2b2b;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  }

  .vendors-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: #ddd;
    font-size: 15px;
    white-space: normal;
  }

  .vendors-table td.cell-logo {
    position: absolute;
    top: 10px;
    left: 12px;
    width: auto;
  }

  .vendors-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .vendors-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: #666;
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .vendors-table tr:hover td {
    background: transparent;
  }
}
</style>
