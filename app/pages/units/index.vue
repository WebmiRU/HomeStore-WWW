<template>
  <div class="units-page">
    <div class="page-header">
      <h3 class="page-title">{{ t('properties.units_list') }}</h3>
      <NuxtLink to="/units/create" class="btn-add">{{ t('common.add') }}</NuxtLink>
    </div>

    <div v-if="loading" class="loading">{{ t('form.loading') }}</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else>
      <table v-if="units.length" class="units-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>{{ t('properties.abbreviation') }}</th>
            <th>{{ t('common.title') }}</th>
            <th>{{ t('common.created') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in units" :key="u.id" @dblclick="openRow($event, `/units/${u.id}`)">
            <td data-label="ID">{{ u.id }}</td>
            <td :data-label="t('properties.abbreviation')">{{ u.title_short }}</td>
            <td :data-label="t('common.title')">{{ u.title_full }}</td>
            <td :data-label="t('common.created')">{{ formatDate(u.created_at) }}</td>
            <td class="actions">
              <NuxtLink
                :to="`/units/${u.id}`"
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
                @click.prevent="deleteUnit(u)"
              >
                <img src="/img/icon/delete.svg" class="action-icon" alt="" />
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty">{{ t('properties.no_units') }}</div>

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
import type { UnitResponse } from '~/repository/modules/unit'

const { $api, $notify } = useNuxtApp()
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { openRow } = useRowOpen()

const units = ref<UnitResponse[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const meta = ref<{ current_page: number; last_page: number }>({ current_page: 0, last_page: 0 })

async function load(page?: number) {
  loading.value = true
  error.value = null
  try {
    const result = await $api.unit.list(page)
    units.value = result.data
    meta.value = { current_page: result.meta.current_page, last_page: result.meta.last_page }
  } catch (err: any) {
    error.value = formatApiError(err, t('properties.units_load_failed'))
  } finally {
    loading.value = false
  }
}

function goToPage(page: number) {
  router.push({ query: { ...route.query, page } })
}

async function deleteUnit(u: UnitResponse) {
  // Единицу измерения могут держать свойства, поэтому предупреждаем: у
  // них пропадёт обозначение, а проверить это заранее нельзя — счётчика
  // использования сервер не отдаёт.
  if (!confirm(t('properties.unit_delete_confirm', { title: `${u.title_short} — ${u.title_full}` }))) return

  try {
    await $api.unit.delete(u.id)
    $notify.add(t('properties.unit_delete_done'), { type: 'success' })
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

.units-table {
  width: 100%;
  border-collapse: collapse;
}

.units-table th,
.units-table td {
  padding: 8px 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.units-table th {
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}

.units-table td {
  color: var(--text-secondary);
}

.units-table tr:hover td {
  background: var(--bg-elevated);
}

.actions {
  white-space: nowrap;
}

.action-link {
  color: var(--link);
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
  color: var(--link-hover);
}

.action-del {
  color: var(--danger);
}

.action-del:hover {
  color: var(--danger);
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

  .units-table,
  .units-table tbody,
  .units-table tr,
  .units-table td {
    display: block;
  }

  .units-table thead {
    display: none;
  }

  .units-table tr {
    position: relative;
    margin-bottom: 14px;
    padding: 44px 14px 14px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--bg-sunken) 25%, transparent);
  }

  .units-table td {
    width: 100%;
    box-sizing: border-box;
    padding: 6px 0;
    border-bottom: 0;
    color: var(--text);
    font-size: 15px;
    white-space: normal;
  }

  .units-table td.actions {
    position: absolute;
    top: 10px;
    right: 12px;
    width: auto;
    padding: 0;
    white-space: nowrap;
  }

  .units-table td::before {
    content: attr(data-label);
    display: block;
    margin-bottom: 3px;
    color: var(--text-faint);
    font-size: 11px;
    letter-spacing: 0.6px;
    text-transform: uppercase;
  }

  .units-table tr:hover td {
    background: transparent;
  }
}
</style>
